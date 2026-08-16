/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  RealtimeKitProvider,
  useRealtimeKitClient,
  useRealtimeKitSelector,
} from "@cloudflare/realtimekit-react";
import type RTKClient from "@cloudflare/realtimekit";
import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClassPlaylistPlayer } from "@/components/ClassPlaylistPlayer";
import { LiveClassPlaylistManager } from "@/components/LiveClassPlaylistManager";
import {
  ClassAudioScreenShare,
  ClassScreenShareButton,
  ClassScreenShareStage,
  ClassVideoContentShare,
} from "@/components/class-screen-share";
import { MediaActivityGuard } from "@/components/MediaActivityGuard";

type RealtimeMode = "group_call" | "webinar" | "livestream";
type Room = {
  code: string;
  title: string;
  streamingMode: "audio" | "video";
  realtimeMode: RealtimeMode;
  classType: "public" | "trial" | "private";
};
type MediaUser = {
  identity: string;
  displayName: string;
  isMember: number;
  micOn: number;
  cameraOn: number;
  isManager: boolean;
};
type StageRequest = {
  identity: string;
  displayName: string;
  mediaKind: "audio" | "video";
  status: string;
};
type Media = {
  streamActive: boolean;
  streamingMode: "audio" | "video";
  realtimeMode: RealtimeMode;
  manager: boolean;
  canPublish: boolean;
  hostOnline: boolean;
  participantLimit: number | null;
  publisherLimit: number | null;
  users: MediaUser[];
  requests: StageRequest[];
  speakers: Array<{ email: string }>;
};
type Message = {
  id: string;
  senderName: string;
  body: string;
  createdAt: number;
};
type Role = "viewer" | "member" | "host";
type PlaylistState = { active: number; currentItemId: string | null };
type PlaylistResponse = {
  items: Array<{ id: string }>;
  state: PlaylistState | null;
};
type PlaylistWindow = Window & {
  __smartClassStopPlaylist?: () => Promise<void>;
};

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M9 21h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="13"
        height="12"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m16 10 5-3v10l-5-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SpeakerIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 10v4h4l5 4V6L8 10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {off ? (
        <path
          d="m17 10 4 4m0-4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16 9a4 4 0 0 1 0 6m2-8a7 7 0 0 1 0 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function AudioTrack({
  track,
  enabled,
  onBlocked,
}: {
  track: MediaStreamTrack;
  enabled: boolean;
  onBlocked: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.srcObject = new MediaStream([track]);
    if (enabled) void audio.play().catch(onBlocked);
    else audio.pause();
    return () => {
      audio.pause();
      audio.srcObject = null;
    };
  }, [enabled, onBlocked, track]);
  return <audio ref={ref} autoPlay={enabled} />;
}
function ParticipantsAudio({
  client,
  enabled,
  onBlocked,
}: {
  client: RTKClient;
  enabled: boolean;
  onBlocked: () => void;
}) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setRevision((value) => value + 1),
      750,
    );
    return () => window.clearInterval(timer);
  }, [client]);
  void revision;
  const peers = new Map<string, { id: string; track: MediaStreamTrack }>();
  [
    client.participants.joined,
    client.participants.active,
    client.participants.audioSubscribed,
  ].forEach((map) =>
    map.toArray().forEach((peer) => {
      if (peer.audioEnabled && peer.audioTrack)
        peers.set(peer.id, {
          id: peer.id,
          track: peer.audioTrack as MediaStreamTrack,
        });
    }),
  );
  return (
    <>
      {[...peers.values()].map((peer) => (
        <AudioTrack
          key={peer.id}
          track={peer.track}
          enabled={enabled}
          onBlocked={onBlocked}
        />
      ))}
    </>
  );
}
function LivestreamPlayer({
  client,
  enabled,
  onBlocked,
}: {
  client: RTKClient;
  enabled: boolean;
  onBlocked: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null),
    [url, setUrl] = useState(""),
    [state, setState] = useState("");
  useEffect(() => {
    const live = client.livestream,
      update = (next: string) => {
        setState(next);
        setUrl(live.playbackUrl || "");
      };
    update(live.state);
    live.on("livestreamUpdate", update);
    const timer = window.setInterval(() => update(live.state), 2000);
    return () => {
      live.off("livestreamUpdate", update);
      window.clearInterval(timer);
    };
  }, [client]);
  useEffect(() => {
    const video = ref.current;
    if (!video || !url || state !== "LIVESTREAMING") return;
    const source = `${url}?dvrEnabled=true`;
    video.muted = !enabled;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: false });
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(
        Hls.Events.MANIFEST_PARSED,
        () => void video.play().catch(onBlocked),
      );
    } else {
      video.src = source;
      void video.play().catch(onBlocked);
    }
    return () => {
      video.pause();
      if (hls) hls.destroy();
      else video.removeAttribute("src");
    };
  }, [enabled, onBlocked, state, url]);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = !enabled;
    if (enabled) void video.play().catch(onBlocked);
  }, [enabled, onBlocked]);
  return (
    <div className="class-livestream-player" data-state={state}>
      <video ref={ref} autoPlay playsInline muted={!enabled} />
      {state !== "LIVESTREAMING" && (
        <strong>
          {state === "STARTING"
            ? "Starting livestream…"
            : "Waiting for livestream…"}
        </strong>
      )}
    </div>
  );
}
type PlaylistViewerResponse = {
  items: Array<{ id: string; title?: string }>;
  state: { active: number; currentItemId: string | null } | null;
};
function PlaylistViewer({
  code,
  streamingMode,
  lang,
}: {
  code: string;
  streamingMode: "audio" | "video";
  lang: "en" | "zh";
}) {
  const [current, setCurrent] = useState<{ id: string; title?: string } | null>(
      null,
    ),
    [cycle, setCycle] = useState(0);
  const load = useCallback(async () => {
    const response = await fetch(`/api/classrooms/${code}/playlist`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as PlaylistViewerResponse,
      item =
        data.items.find(
          (candidate) => candidate.id === data.state?.currentItemId,
        ) ||
        data.items[0] ||
        null;
    setCurrent(data.state?.active ? item : null);
  }, [code]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load]);
  if (!current) return null;
  const source = `/api/classrooms/${code}/playlist/${current.id}?cycle=${cycle}`;
  return (
    <section className="class-livestream-player" data-state="PLAYLIST">
      <strong>{lang === "zh" ? "课堂播放列表" : "Class playlist"}</strong>
      {streamingMode === "video" ? (
        <video
          key={source}
          src={source}
          autoPlay
          muted
          playsInline
          controls
          onEnded={() => setCycle((value) => value + 1)}
        />
      ) : (
        <audio
          key={source}
          src={source}
          autoPlay
          controls
          onEnded={() => setCycle((value) => value + 1)}
          style={{ width: "100%" }}
        />
      )}
      <small>{current.title}</small>
    </section>
  );
}
type RemoteVideoParticipant = {
  name?: string;
  videoTrack?: MediaStreamTrack;
  videoEnabled?: boolean;
  on?: (
    event: "videoUpdate",
    listener: (payload: {
      videoEnabled: boolean;
      videoTrack?: MediaStreamTrack;
    }) => void,
  ) => void;
  off?: (
    event: "videoUpdate",
    listener: (payload: {
      videoEnabled: boolean;
      videoTrack?: MediaStreamTrack;
    }) => void,
  ) => void;
  registerVideoElement?: (element: HTMLVideoElement) => void;
  deregisterVideoElement?: (element?: HTMLVideoElement) => void;
};
function RemoteVideo({
  client,
  peerId,
  name,
  onOpen,
  selected,
}: {
  client: RTKClient;
  peerId: string;
  name: string;
  onOpen: () => void;
  selected: boolean;
}) {
  const readPeer = useCallback(
    () =>
      (client.participants.videoSubscribed.get(peerId) ||
        client.participants.active.get(peerId) ||
        client.participants.joined.get(peerId) ||
        client.participants.all.get(peerId)) as
        | RemoteVideoParticipant
        | undefined,
    [client, peerId],
  );
  const [peer, setPeer] = useState<RemoteVideoParticipant | undefined>(() =>
      readPeer(),
    ),
    [remote, setRemote] = useState<{
      enabled: boolean;
      track?: MediaStreamTrack;
    }>({ enabled: false });
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let alive = true;
    const reconcile = () => {
      const current = readPeer();
      if (alive)
        setPeer((previous) => (previous === current ? previous : current));
      if (
        !current?.videoEnabled ||
        !current.videoTrack ||
        current.videoTrack.readyState !== "live"
      )
        void client.participants
          .subscribe([peerId], ["audio", "video"])
          .catch(() => undefined);
    };
    reconcile();
    const timer = window.setInterval(reconcile, 500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [client, peerId, readPeer]);
  useEffect(() => {
    if (!peer) {
      setRemote({ enabled: false });
      return;
    }
    const update = (payload?: {
      videoEnabled: boolean;
      videoTrack?: MediaStreamTrack;
    }) =>
      setRemote({
        enabled: payload?.videoEnabled ?? Boolean(peer.videoEnabled),
        track: payload?.videoTrack || peer.videoTrack,
      });
    update();
    peer.on?.("videoUpdate", update);
    const timer = window.setInterval(() => update(), 500);
    return () => {
      window.clearInterval(timer);
      peer.off?.("videoUpdate", update);
    };
  }, [peer]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (remote.track?.readyState === "live") {
      element.srcObject = new MediaStream([remote.track]);
      void element.play().catch(() => undefined);
      return () => {
        element.srcObject = null;
      };
    }
    if (peer?.registerVideoElement) {
      peer.registerVideoElement(element);
      return () => peer.deregisterVideoElement?.(element);
    }
    element.srcObject = null;
  }, [peer, remote.enabled, remote.track]);
  if (!remote.enabled && (!remote.track || remote.track.readyState !== "live"))
    return <video ref={ref} autoPlay playsInline hidden />;
  return (
    <button
      className={`class-video-tile${selected ? " selected" : ""}`}
      onClick={onOpen}
    >
      <video ref={ref} autoPlay playsInline />
      <span>{peer?.name || name}</span>
    </button>
  );
}
function VideoGrid({
  client,
  localName,
  mediaUsers,
}: {
  client: RTKClient;
  localName: string;
  mediaUsers: MediaUser[];
}) {
  const local = useRealtimeKitSelector((current) => ({
    enabled: current.self.videoEnabled,
    track: current.self.videoTrack,
  })) as { enabled: boolean; track?: MediaStreamTrack };
  const [revision, setRevision] = useState(0),
    [discovered, setDiscovered] = useState<string[]>([]);
  const ref = useRef<HTMLVideoElement>(null),
    [full, setFull] = useState<string | null>(null),
    [facing, setFacing] = useState<"user" | "environment">("user");
  useEffect(() => {
    const timer = window.setInterval(
      () => setRevision((value) => value + 1),
      750,
    );
    return () => window.clearInterval(timer);
  }, [client]);
  useEffect(() => {
    let alive = true;
    const discover = async () => {
      try {
        const peers = await client.participants.getAllJoinedPeers("", 100, 0),
          ids = peers
            .map((peer) => peer.id)
            .filter((id) => Boolean(id) && id !== client.self.id)
            .sort();
        if (!alive) return;
        setDiscovered((current) =>
          current.length === ids.length &&
          current.every((id, index) => id === ids[index])
            ? current
            : ids,
        );
        if (ids.length)
          await client.participants.subscribe(ids, ["audio", "video"]);
        setRevision((value) => value + 1);
      } catch {}
    };
    void discover();
    const timer = window.setInterval(() => void discover(), 1500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [client]);
  void revision;
  const peerMap = new Map<string, { id: string; name?: string }>();
  [
    client.participants.joined,
    client.participants.active,
    client.participants.videoSubscribed,
    client.participants.audioSubscribed,
  ].forEach((map) =>
    map
      .toArray()
      .forEach((peer) =>
        peerMap.set(peer.id, { id: peer.id, name: peer.name }),
      ),
  );
  discovered.forEach((id) => {
    if (!peerMap.has(id))
      peerMap.set(id, {
        id,
        name:
          mediaUsers.find((user) => user.identity === id)?.displayName ||
          "Participant",
      });
  });
  const peers = [...peerMap.values()];
  useEffect(() => {
    const element = ref.current,
      track = local.track;
    if (!element || !track) return;
    element.srcObject = new MediaStream([track]);
    void element.play().catch(() => undefined);
    return () => {
      element.srcObject = null;
    };
  }, [local.track]);
  async function flip() {
    if (!local.enabled || !local.track) return;
    const next = facing === "user" ? "environment" : "user",
      previous = local.track;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: next } },
      });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("CAMERA_TRACK_MISSING");
      await client.self.disableVideo();
      await client.self.enableVideo(track);
      previous.stop();
      setFacing(next);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (previous.readyState === "live" && !client.self.videoEnabled)
        await client.self.enableVideo(previous).catch(() => undefined);
    }
  }
  return (
    <div
      className={`class-video-grid${full ? " fullscreen" : ""}`}
      data-count={(local.enabled ? 1 : 0) + peers.length}
    >
      {local.enabled && local.track && (
        <button
          className={`class-video-tile${full === "local" ? " selected" : ""}`}
          onClick={() => setFull("local")}
        >
          <video ref={ref} autoPlay muted playsInline />
          <span>{localName}</span>
        </button>
      )}
      {peers.map((peer) => (
        <RemoteVideo
          key={peer.id}
          client={client}
          peerId={peer.id}
          name={peer.name || "Participant"}
          selected={full === peer.id}
          onOpen={() => setFull(peer.id)}
        />
      ))}
      {full && (
        <div className="class-video-full-actions">
          {full === "local" && (
            <button onClick={() => void flip()} aria-label="Flip camera">
              ⇄
            </button>
          )}
          <button
            onClick={() => setFull(null)}
            aria-label="Back to video tiles"
          >
            ▦
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectedRoom({
  client,
  room,
  identity,
  manager,
  displayName,
  role,
  mic,
  camera,
  lang,
  onMedia,
  onLeave,
}: {
  client: RTKClient;
  room: Room;
  identity: string;
  manager: boolean;
  displayName: string;
  role: Role;
  mic: boolean;
  camera: boolean;
  lang: "en" | "zh";
  onMedia: (mic: boolean, camera: boolean) => Promise<void>;
  onLeave: () => void;
}) {
  const [media, setMedia] = useState<Media | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [listening, setListening] = useState(true),
    [blocked, setBlocked] = useState(false),
    [speakerEmail, setSpeakerEmail] = useState("");
  const subscribedPeers = useRef(new Set<string>());
  useEffect(() => {
    if (room.realtimeMode === "livestream" && role === "viewer") return;
    let alive = true;
    const setViewMode = client.participants.setViewMode;
    if (typeof setViewMode === "function")
      void setViewMode
        .call(client.participants, "MANUAL")
        .catch(() => undefined);
    const subscribe = async () => {
      const joined = client.participants.joined.toArray(),
        peers = joined.length
          ? joined
          : await client.participants.getAllJoinedPeers("", 100, 0),
        ids = peers
          .map((peer) => peer.id)
          .filter((id) => id && !subscribedPeers.current.has(id));
      if (!alive || !ids.length) return;
      await client.participants.subscribe(ids, ["audio", "video"]);
      ids.forEach((id) => subscribedPeers.current.add(id));
    };
    void subscribe().catch(() => undefined);
    const timer = window.setInterval(
      () => void subscribe().catch(() => undefined),
      3000,
    );
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [client, role, room.realtimeMode]);
  const load = useCallback(async () => {
    const [m, c] = await Promise.all([
      fetch(
        `/api/classrooms/${room.code}/media?identity=${encodeURIComponent(identity)}`,
        { cache: "no-store" },
      ),
      fetch(`/api/classrooms/${room.code}/chat`, { cache: "no-store" }),
    ]);
    if (m.ok) setMedia(await m.json());
    if (c.ok) setMessages((await c.json()).messages || []);
    await fetch(`/api/classrooms/${room.code}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "heartbeat", identity }),
    });
  }, [identity, room.code]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (media?.canPublish)
      setError((current) =>
        current === "Hand raised. Waiting for the host to approve."
          ? ""
          : current,
      );
  }, [media?.canPublish]);
  useEffect(() => {
    if (
      room.realtimeMode === "livestream" &&
      manager &&
      client.livestream.state !== "LIVESTREAMING" &&
      client.livestream.state !== "STARTING"
    )
      void client.livestream
        .start()
        .catch(() => setError("Unable to start livestream delivery."));
  }, [client, manager, room.realtimeMode]);
  async function change(nextMic: boolean, nextCamera: boolean) {
    setError("");
    try {
      if (
        !manager &&
        role === "viewer" &&
        room.classType !== "private" &&
        room.realtimeMode === "webinar" &&
        !media?.canPublish &&
        (nextMic || nextCamera)
      ) {
        const kind = nextCamera ? "video" : "audio";
        await fetch(`/api/classrooms/${room.code}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "request-stage",
            identity,
            mediaKind: kind,
          }),
        });
        setError("Hand raised. Waiting for the host to approve.");
        await load();
        return;
      }
      if (
        (nextMic || nextCamera) &&
        (window as PlaylistWindow).__smartClassStopPlaylist
      )
        await (window as PlaylistWindow).__smartClassStopPlaylist?.();
      await onMedia(nextMic, nextCamera);
      if (nextMic || nextCamera) setListening(true);
      await load();
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "Unable to change media",
      );
    }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    const response = await fetch(`/api/classrooms/${room.code}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (response.ok) {
      setBody("");
      await load();
    } else setError("Sign in as a member to send messages.");
  }
  async function review(request: StageRequest, approve: boolean) {
    await fetch(`/api/classrooms/${room.code}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "review-stage",
        identity: request.identity,
        mediaKind: request.mediaKind,
        approve,
      }),
    });
    await load();
  }
  async function addSpeaker() {
    if (!speakerEmail.trim()) return;
    const response = await fetch(`/api/classrooms/${room.code}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add-speaker", email: speakerEmail }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) setError(data.error || "Unable to add speaker");
    else {
      setSpeakerEmail("");
      await load();
    }
  }
  return (
    <>
      <header className="class-room-controls">
        <div>
          <i className="live" />
          <b>{lang === "zh" ? "直播课堂" : "Live classroom"}</b>
          <small>
            {room.realtimeMode === "group_call"
              ? "Group call · 100"
              : room.realtimeMode === "webinar"
                ? "Webinar · 9 on stage"
                : "Livestream · 9 speakers"}
          </small>
        </div>
        <nav>
          <button
            className={mic ? "on" : ""}
            onClick={() => void change(!mic, camera)}
            aria-label={lang === "zh" ? "麦克风" : "Microphone"}
          >
            <MicIcon />
          </button>
          {room.streamingMode === "video" && (
            <button
              className={camera ? "on" : ""}
              onClick={() => void change(mic, !camera)}
              aria-label={lang === "zh" ? "摄像头" : "Camera"}
            >
              <CameraIcon />
            </button>
          )}
          {room.streamingMode === "audio" &&
          room.realtimeMode !== "livestream" ? (
            <ClassAudioScreenShare
              code={room.code}
              displayName={displayName}
              manager={manager}
              lang={lang}
              listening={listening}
              onError={setError}
              apiBase="/api/classrooms"
            />
          ) : (
            <ClassScreenShareButton
              client={client}
              manager={manager && room.streamingMode === "video"}
              lang={lang}
              onError={setError}
            />
          )}{" "}
          {room.streamingMode === "video" && (
            <ClassVideoContentShare
              client={client}
              code={room.code}
              identity={identity}
              mic={mic}
              manager={manager}
              lang={lang}
              onError={setError}
              apiBase="/api/classrooms"
            />
          )}
          <button
            className={listening ? "on" : ""}
            onClick={() => {
              setListening((value) => !value);
              setBlocked(false);
            }}
            aria-label={lang === "zh" ? "扬声器" : "Device speaker"}
          >
            <SpeakerIcon off={!listening} />
          </button>
          <button className="leave" onClick={onLeave}>
            {lang === "zh" ? "离开" : "Leave"}
          </button>
        </nav>
      </header>
      {error && (
        <p className="class-room-error" role="alert">
          {error}
        </p>
      )}
      {blocked && (
        <button
          className="class-audio-unlock"
          onClick={() => {
            setListening(true);
            setBlocked(false);
          }}
        >
          {lang === "zh" ? "开始收听" : "Start listening"}
        </button>
      )}
      {room.streamingMode === "video" && (
        <ClassScreenShareStage
          client={client}
          lang={lang}
          listening={listening}
        />
      )}
      {room.realtimeMode === "livestream" && role === "viewer" ? (
        <LivestreamPlayer
          client={client}
          enabled={listening}
          onBlocked={() => setBlocked(true)}
        />
      ) : (
        <>
          <ParticipantsAudio
            client={client}
            enabled={listening}
            onBlocked={() => setBlocked(true)}
          />
          {room.streamingMode === "video" && (
            <VideoGrid
              client={client}
              localName={displayName}
              mediaUsers={media?.users || []}
            />
          )}
        </>
      )}
      {manager &&
        room.realtimeMode === "webinar" &&
        Boolean(media?.requests.length) && (
          <section className="class-stage-panel">
            <h3>Raised hands</h3>
            {media!.requests.map((request) => (
              <article key={`${request.identity}-${request.mediaKind}`}>
                <span>
                  {request.displayName} · {request.mediaKind}
                </span>
                <button onClick={() => void review(request, true)}>
                  Approve
                </button>
                <button onClick={() => void review(request, false)}>
                  Deny
                </button>
              </article>
            ))}
          </section>
        )}
      {manager && room.realtimeMode === "livestream" && (
        <section className="class-stage-panel">
          <h3>Livestream speakers</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void addSpeaker();
            }}
          >
            <input
              type="email"
              value={speakerEmail}
              onChange={(event) => setSpeakerEmail(event.target.value)}
              placeholder={
                lang === "zh" ? "已注册会员邮箱" : "Registered member email"
              }
            />
            <button>Add speaker</button>
          </form>
          {media?.speakers.map((item) => (
            <span key={item.email}>{item.email}</span>
          ))}
        </section>
      )}
      <section className="class-chat">
        <header>
          <h2>Class chat</h2>
          <span>{media?.users.length || 0} online</span>
        </header>
        <div>
          {messages.map((message) => (
            <article key={message.id}>
              <b>{message.senderName}</b>
              <p>{message.body}</p>
              <small>
                {new Date(message.createdAt * 1000).toLocaleTimeString()}
              </small>
            </article>
          ))}
        </div>
        <form onSubmit={send}>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={lang === "zh" ? "输入消息…" : "Write a message…"}
          />
          <button>{lang === "zh" ? "发送" : "Send"}</button>
        </form>
      </section>
    </>
  );
}

export function LiveClassRoomClient({
  room,
  displayName,
  manager,
  lang = "en",
}: {
  room: Room;
  displayName: string;
  manager: boolean;
  lang?: "en" | "zh";
}) {
  const [client, initClient] = useRealtimeKitClient({ resetOnLeave: true }),
    [joined, setJoined] = useState(false),
    [localPublisherStarted, setLocalPublisherStarted] = useState(false),
    [role, setRole] = useState<Role>("viewer"),
    [mic, setMic] = useState(false),
    [camera, setCamera] = useState(false),
    [identity] = useState(() => crypto.randomUUID()),
    [error, setError] = useState(""),
    [connecting, setConnecting] = useState(false),
    [playlistEnabled, setPlaylistEnabled] = useState(false),
    [hostOnline, setHostOnline] = useState(manager),
    [humanStreamActive, setHumanStreamActive] = useState(false),
    [humanStreamSeen, setHumanStreamSeen] = useState(false),
    [hasAudience, setHasAudience] = useState(true),
    joining = useRef(false),
    idleSince = useRef<number | null>(null);
  const disconnect = useCallback(
    async (report = true) => {
      const audioTrack = client?.self.audioTrack,
        videoTrack = client?.self.videoTrack,
        wasPublishing = Boolean(
          client?.self.audioEnabled || client?.self.videoEnabled,
        );
      try {
        await (window as PlaylistWindow).__smartClassStopPlaylist?.();
        await client?.self.disableScreenShare();
        await client?.self.disableAudio();
        await client?.self.disableVideo();
        audioTrack?.stop();
        videoTrack?.stop();
        if (
          room.realtimeMode === "livestream" &&
          wasPublishing &&
          client?.livestream.state === "LIVESTREAMING"
        )
          await client.livestream.stop();
        await client?.leave();
      } catch {
        audioTrack?.stop();
        videoTrack?.stop();
      }
      if (report)
        await fetch(`/api/classrooms/${room.code}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "leave", identity }),
          keepalive: true,
        }).catch(() => undefined);
      setMic(false);
      setCamera(false);
      setJoined(false);
    },
    [client, identity, room.code, room.realtimeMode],
  );
  const connect = useCallback(
    async ({
      start = false,
      publish = false,
      nextMic = false,
      nextCamera = false,
    }: {
      start?: boolean;
      publish?: boolean;
      nextMic?: boolean;
      nextCamera?: boolean;
    } = {}) => {
      if (joining.current) return;
      joining.current = true;
      setConnecting(true);
      setError("");
      try {
        if (client && joined) await disconnect(false);
        const response = await fetch(`/api/classrooms/${room.code}/join`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              displayName,
              identity,
              start,
              publish,
            }),
          }),
          data = (await response.json().catch(() => ({}))) as {
            authToken?: string;
            role?: Role;
            error?: string;
          };
        if (!response.ok || !data.authToken) {
          if (data.error !== "STREAM_NOT_ACTIVE")
            setError(data.error || "Unable to connect");
          return;
        }
        const next = await initClient({
          authToken: data.authToken,
          defaults: { audio: false, video: false },
        });
        await next?.join();
        await next?.self.disableAudio();
        await next?.self.disableVideo();
        const approval = await fetch(`/api/classrooms/${room.code}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "media",
            identity,
            mic: nextMic,
            camera: nextCamera,
          }),
        });
        if (!approval.ok)
          throw new Error(
            ((await approval.json().catch(() => ({}))) as { error?: string })
              .error || "Media permission denied",
          );
        if (nextMic) await next?.self.enableAudio();
        if (nextCamera) await next?.self.enableVideo();
        setRole(data.role || "viewer");
        setMic(nextMic);
        setCamera(nextCamera);
        setJoined(true);
      } catch (issue) {
        setError(
          issue instanceof Error
            ? issue.message
            : "Live media connection failed.",
        );
      } finally {
        joining.current = false;
        setConnecting(false);
      }
    },
    [client, disconnect, displayName, identity, initClient, joined, room.code],
  );
  const changeMedia = useCallback(
    async (nextMic: boolean, nextCamera: boolean) => {
      if (nextMic || nextCamera) setLocalPublisherStarted(true);
      if (role !== "viewer" || nextMic || nextCamera) {
        await connect({ publish: true, nextMic, nextCamera });
        return;
      }
      const response = await fetch(`/api/classrooms/${room.code}/media`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "media",
          identity,
          mic: nextMic,
          camera: nextCamera,
        }),
      });
      if (!response.ok)
        throw new Error(
          ((await response.json().catch(() => ({}))) as { error?: string })
            .error || "Unable to change media",
        );
      const audioTrack = client?.self.audioTrack,
        videoTrack = client?.self.videoTrack;
      if (nextMic) await client?.self.enableAudio();
      else {
        await client?.self.disableAudio();
        audioTrack?.stop();
      }
      if (nextCamera) await client?.self.enableVideo();
      else {
        await client?.self.disableVideo();
        videoTrack?.stop();
      }
      setMic(nextMic);
      setCamera(nextCamera);
    },
    [client, connect, identity, role, room.code],
  );
  const reportLeave = useCallback(() => {
    void fetch(`/api/classrooms/${room.code}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "leave", identity }),
      keepalive: true,
    }).catch(() => undefined);
  }, [identity, room.code]);
  const leave = useCallback(async () => {
    await disconnect(true);
    window.location.assign(`/${lang}/classrooms/${room.code}`);
  }, [disconnect, lang, room.code]);
  useEffect(() => {
    if (joined || playlistEnabled) {
      idleSince.current = null;
      return;
    }
    if (idleSince.current === null) idleSince.current = Date.now();
    const remaining = Math.max(0, 60000 - (Date.now() - idleSince.current)),
      idle = window.setTimeout(leave, remaining);
    return () => window.clearTimeout(idle);
  }, [connecting, joined, leave, playlistEnabled]);
  useEffect(() => {
    if (!joined || room.realtimeMode === "livestream" || hasAudience) return;
    const idle = window.setTimeout(leave, 60000);
    return () => window.clearTimeout(idle);
  }, [hasAudience, joined, leave, room.realtimeMode]);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const [mediaResponse, playlistResponse] = await Promise.all([
        fetch(`/api/classrooms/${room.code}/media`, { cache: "no-store" }),
        fetch(`/api/classrooms/${room.code}/playlist`, { cache: "no-store" }),
      ]);
      if (!alive) return;
      const mediaState = mediaResponse.ok
          ? ((await mediaResponse.json()) as Media)
          : null,
        playlist = playlistResponse.ok
          ? ((await playlistResponse.json()) as PlaylistResponse)
          : null,
        active = Boolean(playlist?.state?.active && playlist.items.length);
      setPlaylistEnabled(active);
      if (mediaState) {
        setHostOnline(Boolean(mediaState.hostOnline) || manager);
        setHasAudience(
          manager
            ? mediaState.users.some(
                (user) => user.identity !== identity && !user.isManager,
              )
            : mediaState.users.some((user) => user.identity !== identity),
        );
        const nextHumanStreamActive = Boolean(
          mediaState.users?.some((user) =>
            Boolean(user.micOn || user.cameraOn),
          ),
        );
        setHumanStreamActive(nextHumanStreamActive);
        if (nextHumanStreamActive) setHumanStreamSeen(true);
      }
      if (mediaState?.streamActive && !joined && !joining.current)
        void connect();
      if (
        mediaState &&
        !mediaState.streamActive &&
        joined &&
        !manager
      )
        void disconnect(true);
    };
    void check();
    const poll = window.setInterval(() => void check(), 3000),
      visible = () => {
        if (document.visibilityState === "visible") void check();
      };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [connect, disconnect, identity, joined, manager, room.code]);
  useEffect(() => {
    if (!joined || manager || hostOnline) return;
    const timer = window.setTimeout(() => {
      setError(
        lang === "zh"
          ? "主持人离线已满 5 分钟，已自动离开课堂。"
          : "The host has been offline for 5 minutes. You have left the classroom.",
      );
      void disconnect(true);
      window.setTimeout(
        () => window.location.assign(`/${lang}/classrooms/${room.code}`),
        900,
      );
    }, 300000);
    return () => window.clearTimeout(timer);
  }, [disconnect, hostOnline, joined, lang, manager, room.code]);
  useEffect(() => {
    const cleanup = () => {
      const body = new Blob([JSON.stringify({ action: "leave", identity })], {
        type: "application/json",
      });
      if (!navigator.sendBeacon(`/api/classrooms/${room.code}/media`, body))
        reportLeave();
      void disconnect(false);
    };
    window.addEventListener("pagehide", cleanup);
    return () => window.removeEventListener("pagehide", cleanup);
  }, [disconnect, identity, reportLeave, room.code]);
  const managerPanel = manager ? (
    <LiveClassPlaylistManager
      code={room.code}
      locale={lang}
      realtimeMode={room.realtimeMode}
    />
  ) : null;
  const waitingPlaylist = (
    <ClassPlaylistPlayer
      code={room.code}
      locale={lang}
      apiBase="/api/classrooms"
      enabled={playlistEnabled && !humanStreamActive && !humanStreamSeen}
    />
  );
  if (!joined || !client)
    return (
      <>
        {managerPanel}
        {waitingPlaylist}
        <section className="class-waiting">
          <span className="stream-spinner" />
          <h2>
            {connecting
              ? "Connecting…"
              : manager
                ? "Start the live classroom"
                : "Waiting for live classroom"}
          </h2>
          <p>
            {manager
              ? "Start this site's independent live media session. Microphone and camera remain off until selected."
              : "You join automatically as a viewer when streaming starts. No device permission is requested."}
          </p>
          {manager && (
            <button
              disabled={connecting}
              onClick={() => void connect({ start: true })}
            >
              {lang === "zh" ? "开始直播" : "Start live streaming"}
            </button>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
      </>
    );
  return (
    <>
      {managerPanel}
      {waitingPlaylist}
      <MediaActivityGuard
        active={joined && localPublisherStarted}
        mode={room.streamingMode}
        room={client}
        locale={lang}
        onExpire={() => void leave()}
      />
      <RealtimeKitProvider value={client}>
        <ConnectedRoom
          client={client}
          room={room}
          identity={identity}
          manager={manager}
          displayName={displayName}
          role={role}
          mic={mic}
          camera={camera}
          lang={lang}
          onMedia={changeMedia}
          onLeave={() => void leave()}
        />
      </RealtimeKitProvider>
    </>
  );
}
