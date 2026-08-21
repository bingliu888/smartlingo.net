import {
  classAccess,
  classByCode,
  recordClassJoin,
  verifyClassEntryPassword,
} from "@/lib/live-classrooms";
import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import {
  createClassParticipant,
  createClassProviderRoom,
} from "@/lib/live-class-realtimekit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params,
      room = await classByCode(code);
    if (!room)
      return Response.json({ error: "Course not found" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as {
        displayName?: string;
        password?: string;
        identity?: string;
        publish?: boolean;
        start?: boolean;
        screenShareCompanion?: boolean;
      },
      user = await getSessionUser(request),
      access = await classAccess(room, user, true);
    if (!access.allowed)
      return Response.json(
        { error: "Private course invitation required" },
        { status: 403 },
      );
    if (room.hasPassword && !access.manager && !await verifyClassEntryPassword(code, String(body.password || "")))
      return Response.json({ error: "Incorrect course password", errorCode: "INCORRECT_CLASS_PASSWORD" }, { status: 403 });
    const db = getDatabase(),
      now = Math.floor(Date.now() / 1000),
      identity = String(body.identity || crypto.randomUUID()).slice(0, 100),
      displayName =
        String(body.displayName || user?.displayName || "Guest")
          .trim()
          .slice(0, 80) || "Guest";
    let providerMeetingId = room.providerMeetingId;
    if (
      body.publish &&
      (access.manager || room.realtimeMode === "group_call") &&
      !room.streamActive &&
      !providerMeetingId
    ) {
      const created = await createClassProviderRoom(room.title);
      providerMeetingId = created.id;
      await db
        .prepare(
          "UPDATE live_class_rooms SET provider_meeting_id=?,stream_active=1,mute_all=0,updated_at=? WHERE id=?",
        )
        .bind(providerMeetingId, now, room.id)
        .run();
    }
    if (!providerMeetingId || (!room.streamActive && !body.start && !body.publish))
      return Response.json({ error: "STREAM_NOT_ACTIVE" }, { status: 409 });
    if (body.screenShareCompanion) {
      if (room.streamingMode !== "audio" || room.realtimeMode === "livestream")
        return Response.json(
          { error: "Screen-share companion is unavailable" },
          { status: 409 },
        );
      const participant = await createClassParticipant(
        providerMeetingId,
        "screenshare-" + (user?.id || crypto.randomUUID()),
        displayName + " · Screen",
        access.manager ? "host" : "viewer",
        room.realtimeMode,
      );
      return Response.json({
        authToken: participant.token,
        role: access.manager ? "host" : "viewer",
        meetingId: providerMeetingId,
        screenShareCompanion: true,
      });
    }
    const active = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM live_class_media_presence WHERE room_id=? AND active=1 AND last_seen_at>?",
      )
      .bind(room.id, now - 45)
      .first<{ count: number }>();
    if (
      room.realtimeMode === "group_call" &&
      Number(active?.count || 0) >= 100 &&
      !(await db
        .prepare(
          "SELECT 1 FROM live_class_media_presence WHERE room_id=? AND identity=? AND active=1",
        )
        .bind(room.id, identity)
        .first())
    )
      return Response.json(
        {
          error: "Too many people in streaming",
          errorCode: "STREAMING_ROOM_FULL",
          participantLimit: 100,
        },
        { status: 409 },
      );
    let role: "viewer" | "member" | "host" = "viewer",
      canPublish =
        access.manager ||
        room.classType === "private" ||
        room.realtimeMode === "group_call";
    if (room.realtimeMode === "webinar" && !canPublish) {
      canPublish = Boolean(
        await db
          .prepare(
            "SELECT 1 FROM live_class_stage_requests WHERE room_id=? AND identity=? AND status='approved' LIMIT 1",
          )
          .bind(room.id, identity)
          .first(),
      );
    }
    if (room.realtimeMode === "livestream" && !canPublish && user) {
      canPublish = Boolean(
        await db
          .prepare(
            "SELECT 1 FROM live_class_stage_speakers WHERE room_id=? AND lower(member_email)=lower(?) LIMIT 1",
          )
          .bind(room.id, user.email)
          .first(),
      );
    }
    if (access.manager) role = "host";
    else if (body.publish) {
      if (!canPublish)
        return Response.json(
          {
            error:
              room.realtimeMode === "webinar"
                ? "Raise your hand and wait for host approval"
                : "The host has not added this member email as a speaker",
            errorCode: "STAGE_ACCESS_REQUIRED",
          },
          { status: 403 },
        );
      if (room.realtimeMode !== "group_call") {
        const count = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM live_class_media_presence WHERE room_id=? AND active=1 AND (mic_on=1 OR camera_on=1) AND last_seen_at>?",
          )
          .bind(room.id, now - 45)
          .first<{ count: number }>();
        if (Number(count?.count || 0) >= 9)
          return Response.json(
            { error: "The 9-speaker stage is full", errorCode: "STAGE_FULL" },
            { status: 409 },
          );
      }
      role = "member";
    }
    const participant = await createClassParticipant(
      providerMeetingId,
      identity,
      displayName,
      role,
      room.realtimeMode,
    );
    await db
      .prepare(
        `INSERT INTO live_class_media_presence(id,room_id,identity,user_id,display_name,is_member,mic_on,camera_on,active,last_seen_at) VALUES(?,?,?,?,?,?,0,0,1,?) ON CONFLICT(room_id,identity) DO UPDATE SET user_id=excluded.user_id,display_name=excluded.display_name,is_member=excluded.is_member,active=1,last_seen_at=excluded.last_seen_at`,
      )
      .bind(
        createId(),
        room.id,
        identity,
        user?.id || null,
        displayName,
        user ? 1 : 0,
        now,
      )
      .run();
    if (user) await recordClassJoin(user.id, room.id, now);
    return Response.json({
      authToken: participant.token,
      identity,
      role,
      meetingId: providerMeetingId,
      streamingMode: room.streamingMode,
      realtimeMode: room.realtimeMode,
      manager: access.manager,
      canPublish,
      participantLimit: room.realtimeMode === "group_call" ? 100 : null,
      publisherLimit: room.realtimeMode === "group_call" ? null : 9,
    });
  } catch (issue) {
    const message =
      issue instanceof Error ? issue.message : "REALTIMEKIT_REQUEST_FAILED";
    console.error("Course room RealtimeKit join failed", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
