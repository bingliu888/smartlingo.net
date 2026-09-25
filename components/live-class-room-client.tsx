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
import {
  formatConnectionDuration,
  mediaGridLayout,
  shouldAutoJoinClassRoom,
} from "@/lib/class-realtime-participant-state";
import { classRoomWaitingCopy } from "@/lib/class-room-waiting-copy";
import { classPollDelay } from "@/lib/realtime-client-budget";
import {
  createLocalMediaHealthMonitor,
  publishedLocalTrackIsLive,
} from "@/lib/local-media-health";
import { createRemoteMediaRecovery } from "@/lib/remote-media-recovery";
import { ClassroomSupportChat, type ClassroomSupportChatHandle } from "@/components/ClassroomSupportChat";
import { RoomPresenceTicker, type RoomPresenceEvent } from "@/components/RoomPresenceTicker";
import { roomPresenceChanges } from "@/lib/class-room-presence-events";
import { ClassRoomResources } from "@/components/ClassRoomResources";

type RealtimeMode = "group_call" | "webinar" | "livestream";
type Room = {
  code: string;
  title: string;
  streamingMode: "audio" | "video";
  realtimeMode: RealtimeMode;
  classType: "public" | "trial" | "private";
};
type MediaUser = {
  identity?: string;
  self?: boolean;
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
  providerMeetingId?: string | null;
  screenShareActive?: boolean;
  streamingMode: "audio" | "video";
  realtimeMode: RealtimeMode;
  manager: boolean;
  canPublish: boolean;
  approvedMediaKinds?: Array<"audio" | "video">;
  hostOnline: boolean;
  participantLimit: number | null;
  publisherLimit: number | null;
  users: MediaUser[];
  requests: StageRequest[];
  speakers: Array<{ email: string }>;
  hasOtherParticipants?: boolean;
  hasAudience?: boolean;
};
type OnlineMember = { userId:string; displayName:string; enteredAt:number };
const COLLABORATION_SHARE_CONTROLS_VISIBLE=false;
function UsersIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M19 14a5 5 0 0 1 2 4v2"/></svg>}
function HangupIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 5C7.8 5 4.2 6.5 1.7 9.2a2.7 2.7 0 0 0-.5 2.6l.8 2.2a2 2 0 0 0 2.4 1.2l2.2-.6a2 2 0 0 0 1.5-1.9v-1.3a14 14 0 0 1 7.8 0v1.3a2 2 0 0 0 1.5 1.9l2.2.6a2 2 0 0 0 2.4-1.2l.8-2.2a2.7 2.7 0 0 0-.5-2.6A15.3 15.3 0 0 0 12 5Z"/></svg>}
function AudioFileIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h9l5 5v13H5zM14 3v5h5M10 15v3a2 2 0 1 1-2-2M10 15l5-1v3a2 2 0 1 1-2-2v-5l-5 1v5"/></svg>}
function PaperclipIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m8 12 6-6a4 4 0 0 1 6 6l-8 8a6 6 0 0 1-9-9l8-8"/></svg>}
type Role = "viewer" | "member" | "host";
type PlaylistState = { active: number; currentItemId: string | null };
type PlaylistResponse = {
  items: Array<{ id: string }>;
  state: PlaylistState | null;
};
type RecordingArtifact = {
  id: string;
  status: "pending" | "recording" | "processing" | "ready" | "errored" | "deleted";
  recordingSeconds: number;
  audioSizeBytes: number;
  createdAt: number;
};
type RecordingResponse = {
  artifacts: RecordingArtifact[];
  recording: boolean;
  manager: boolean;
};
type PlaylistWindow = Window;

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
  id,
  track,
  enabled,
  onBlocked,
  onPlaybackChange,
}: {
  id: string;
  track: MediaStreamTrack;
  enabled: boolean;
  onBlocked: () => void;
  onPlaybackChange: (id: string, playing: boolean) => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const playing = () => onPlaybackChange(id, true),
      stopped = () => onPlaybackChange(id, false);
    audio.addEventListener("playing", playing);
    audio.addEventListener("pause", stopped);
    audio.addEventListener("ended", stopped);
    audio.addEventListener("emptied", stopped);
    audio.srcObject = new MediaStream([track]);
    if (enabled)
      void audio.play().catch(() => {
        stopped();
        onBlocked();
      });
    else {
      audio.pause();
      stopped();
    }
    return () => {
      audio.pause();
      audio.srcObject = null;
      stopped();
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("pause", stopped);
      audio.removeEventListener("ended", stopped);
      audio.removeEventListener("emptied", stopped);
    };
  }, [enabled, id, onBlocked, onPlaybackChange, track]);
  return <audio ref={ref} autoPlay={enabled} />;
}
function ParticipantsAudio({
  client,
  enabled,
  onBlocked,
  onPlaybackChange,
}: {
  client: RTKClient;
  enabled: boolean;
  onBlocked: () => void;
  onPlaybackChange: (id: string, playing: boolean) => void;
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
          id={`participant:${peer.id}`}
          track={peer.track}
          enabled={enabled}
          onBlocked={onBlocked}
          onPlaybackChange={onPlaybackChange}
        />
      ))}
    </>
  );
}
function LivestreamPlayer({
  client,
  enabled,
  onBlocked,
  onPlaybackChange,
}: {
  client: RTKClient;
  enabled: boolean;
  onBlocked: () => void;
  onPlaybackChange: (id: string, playing: boolean) => void;
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
    const playing = () => onPlaybackChange("livestream", true),
      stopped = () => onPlaybackChange("livestream", false);
    video.addEventListener("playing", playing);
    video.addEventListener("pause", stopped);
    video.addEventListener("ended", stopped);
    video.addEventListener("emptied", stopped);
    const source = `${url}?dvrEnabled=true`;
    video.muted = !enabled;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: false });
      hls.loadSource(source);
      hls.attachMedia(video);
      hls.on(
        Hls.Events.MANIFEST_PARSED,
        () =>
          void video.play().catch(() => {
            stopped();
            onBlocked();
          }),
      );
    } else {
      video.src = source;
      void video.play().catch(() => {
        stopped();
        onBlocked();
      });
    }
    return () => {
      video.pause();
      stopped();
      video.removeEventListener("playing", playing);
      video.removeEventListener("pause", stopped);
      video.removeEventListener("ended", stopped);
      video.removeEventListener("emptied", stopped);
      if (hls) hls.destroy();
      else video.removeAttribute("src");
    };
  }, [enabled, onBlocked, onPlaybackChange, state, url]);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = !enabled;
    if (enabled)
      void video.play().catch(() => {
        onPlaybackChange("livestream", false);
        onBlocked();
      });
    else onPlaybackChange("livestream", false);
  }, [enabled, onBlocked, onPlaybackChange]);
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
  showLocalVideo,
}: {
  client: RTKClient;
  localName: string;
  mediaUsers: MediaUser[];
  showLocalVideo:boolean;
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
  const peerMap = new Map<string, { id: string; name?: string; videoEnabled?: boolean; videoTrack?: MediaStreamTrack }>();
  [
    client.participants.joined,
    client.participants.active,
    client.participants.videoSubscribed,
    client.participants.audioSubscribed,
  ].forEach((map) =>
    map
      .toArray()
      .forEach((peer) =>
        peerMap.set(peer.id, {
          id: peer.id,
          name: peer.name,
          videoEnabled: peer.videoEnabled,
          videoTrack: peer.videoTrack as MediaStreamTrack | undefined,
        }),
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
  const peers = [...peerMap.values()].filter((peer) =>
    Boolean(peer.videoEnabled || peer.videoTrack?.readyState === "live"),
  );
  const tileCount = (showLocalVideo && local.enabled && local.track ? 1 : 0) + peers.length;
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
      data-count={tileCount}
      data-layout={mediaGridLayout(tileCount)}
    >
      {showLocalVideo && local.enabled && local.track && (
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
  sessionToken,
  manager,
  displayName,
  role,
  mic,
  camera,
  micLive,
  cameraLive,
  onlineMembers,
  roomPresenceEvents,
  roomTabId,
  resourceBusy,
  onLocalNoteBusyChange,
  onMention,
  initialListening,
  onListeningChange,
  lang,
  onMedia,
  onLeave,
}: {
  client: RTKClient;
  room: Room;
  identity: string;
  sessionToken: string;
  manager: boolean;
  displayName: string;
  role: Role;
  mic: boolean;
  camera: boolean;
  micLive: boolean;
  cameraLive: boolean;
  onlineMembers: OnlineMember[];
  roomPresenceEvents: RoomPresenceEvent[];
  roomTabId: string;
  resourceBusy: boolean;
  onLocalNoteBusyChange: (busy:boolean)=>void;
  onMention: (name:string)=>void;
  initialListening:boolean;
  onListeningChange:(enabled:boolean)=>void;
  lang: "en" | "zh";
  onMedia: (mic: boolean, camera: boolean) => Promise<void>;
  onLeave: () => void;
}) {
  const [media, setMedia] = useState<Media | null>(null),
    [error, setError] = useState(""),
    [listening, setListening] = useState(initialListening),
    [blocked, setBlocked] = useState(false),
    [speakerEmail, setSpeakerEmail] = useState(""),
    [connectedSeconds, setConnectedSeconds] = useState(0),
    [confirmLeave, setConfirmLeave] = useState(false),
    [recordings, setRecordings] = useState<RecordingArtifact[]>([]),
    [recordingActive, setRecordingActive] = useState(false),
    [recordingBusy, setRecordingBusy] = useState(false),
    [roomPanel,setRoomPanel] = useState<"users"|"recordings"|"files"|null>(null),
    [changingMedia, setChangingMedia] = useState(false),
    [pendingMedia, setPendingMedia] = useState<{ mic: boolean; camera: boolean } | null>(null),
    [playbackConfirmed, setPlaybackConfirmed] = useState(false);
  const audioSubscribedPeers = useRef(new Set<string>()),
    videoSubscribedPeers = useRef(new Set<string>()),
    cameraBeforeScreenShare = useRef(false),
    changingMediaRef = useRef(false),
    playingSources = useRef(new Set<string>());
  const onPlaybackChange = useCallback((id: string, playing: boolean) => {
    if (playing) playingSources.current.add(id);
    else playingSources.current.delete(id);
    setPlaybackConfirmed(playingSources.current.size > 0);
  }, []);
  const onPlaybackBlocked = useCallback(() => setBlocked(true), []);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setConnectedSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (room.realtimeMode === "livestream" && role === "viewer") return;
    let alive = true;
    const setViewMode = client.participants.setViewMode;
    const peers = (kind: "audio" | "video") => {
      const map = new Map<
        string,
        {
          id: string;
          enabled?: boolean;
          track?: MediaStreamTrack;
        }
      >();
      [
        client.participants.joined,
        client.participants.active,
        client.participants.audioSubscribed,
        client.participants.videoSubscribed,
      ].forEach((participants) =>
        participants.toArray().forEach((peer) => {
          if (!peer.id || peer.id === client.self.id) return;
          map.set(peer.id, {
            id: peer.id,
            enabled:
              kind === "audio" ? peer.audioEnabled : peer.videoEnabled,
            track: (kind === "audio"
              ? peer.audioTrack
              : peer.videoTrack) as MediaStreamTrack | undefined,
          });
        }),
      );
      return [...map.values()];
    };
    const audioRecovery = createRemoteMediaRecovery({
        peers: () => peers("audio"),
        subscribed: audioSubscribedPeers.current,
        subscribe: (ids) => client.participants.subscribe(ids, ["audio"]),
        unsubscribe: (ids) => client.participants.unsubscribe(ids, ["audio"]),
      }),
      videoRecovery = createRemoteMediaRecovery({
        peers: () => peers("video"),
        subscribed: videoSubscribedPeers.current,
        subscribe: (ids) => client.participants.subscribe(ids, ["video"]),
        unsubscribe: (ids) => client.participants.unsubscribe(ids, ["video"]),
      }),
      reconcile = () => {
        if (!alive) return;
        void audioRecovery.reconcile();
        void videoRecovery.reconcile();
      };
    void (async () => {
      if (typeof setViewMode === "function")
        await setViewMode
          .call(client.participants, "MANUAL")
          .catch(() => undefined);
      reconcile();
    })();
    const timer = window.setInterval(
      reconcile,
      2000,
    );
    return () => {
      alive = false;
      audioRecovery.stop();
      videoRecovery.stop();
      window.clearInterval(timer);
    };
  }, [client, role, room.realtimeMode]);
  const load = useCallback(async () => {
    const m = await fetch(
        `/api/classrooms/${room.code}/media?identity=${encodeURIComponent(identity)}`,
        {
          cache: "no-store",
          headers: sessionToken ? { "x-class-session-token": sessionToken } : {},
        },
      );
    if (m.ok) setMedia(await m.json());
    await fetch(`/api/classrooms/${room.code}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "heartbeat", identity, sessionToken, mic, camera }),
    });
  }, [camera, identity, mic, room.code, sessionToken]);
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let failures = 0;
    const cycle = async () => {
      try {
        await load();
        failures = 0;
      } catch {
        failures += 1;
      }
      if (!cancelled)
        timer = window.setTimeout(cycle, classPollDelay({
          kind: "media",
          joined: true,
          moderator: manager,
          hidden: document.hidden,
          failures,
          jitter: Math.random(),
        }));
    };
    void cycle();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [load, manager]);
  const loadRecordings = useCallback(async () => {
    const response = await fetch(`/api/classrooms/${room.code}/recording`, {
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json() as RecordingResponse;
    setRecordings(Array.isArray(data.artifacts) ? data.artifacts : []);
    setRecordingActive(Boolean(data.recording));
  }, [room.code]);
  useEffect(() => {
    void loadRecordings();
    const timer = window.setInterval(() => void loadRecordings(), 10_000);
    return () => window.clearInterval(timer);
  }, [loadRecordings]);
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
    if (changingMediaRef.current) return;
    changingMediaRef.current = true;
    setChangingMedia(true);
    setPendingMedia({ mic: nextMic, camera: nextCamera });
    setError("");
    try {
      if (
        !manager &&
        role === "viewer" &&
        room.realtimeMode === "webinar" &&
        (nextMic || nextCamera)
      ) {
        const kind = nextCamera ? "video" : "audio";
        if (media?.approvedMediaKinds?.includes(kind)) {
          await onMedia(nextMic, nextCamera);
          return;
        }
        const response = await fetch(`/api/classrooms/${room.code}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "request-stage",
            identity,
            sessionToken,
            mediaKind: kind,
          }),
        });
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(result.error || (lang === "zh" ? "举手请求未发送，请重新进入课程后再试。" : "The hand-raise request was not sent. Rejoin the course and try again."));
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
    } finally {
      changingMediaRef.current = false;
      setChangingMedia(false);
      setPendingMedia(null);
    }
  }
  async function review(request: StageRequest, approve: boolean) {
    const response = await fetch(`/api/classrooms/${room.code}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "review-stage",
        sessionToken,
        identity,
        targetIdentity: request.identity,
        mediaKind: request.mediaKind,
        approve,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setError(result.error || "Unable to review stage request");
      return;
    }
    setError("");
    await load();
  }
  async function addSpeaker() {
    if (!speakerEmail.trim()) return;
    const response = await fetch(`/api/classrooms/${room.code}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add-speaker", sessionToken, email: speakerEmail }),
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
  async function changeRecording(action: "start" | "stop") {
    setRecordingBusy(true);
    setError("");
    const response = await fetch(`/api/classrooms/${room.code}/recording`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, identity, sessionToken }),
    }).catch(() => null);
    const data = response
      ? await response.json().catch(() => ({})) as { error?: string }
      : { error: "Recording service unavailable" };
    if (!response?.ok) setError(data.error || "Unable to change recording");
    await loadRecordings();
    setRecordingBusy(false);
  }
  async function deleteRecording(id: string) {
    setRecordingBusy(true);
    const response = await fetch(`/api/classrooms/${room.code}/recording/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setError(data.error || "Unable to delete recording");
    }
    await loadRecordings();
    setRecordingBusy(false);
  }
  const showDevices=manager||room.realtimeMode==="group_call"||(room.realtimeMode==="webinar"&&Boolean(media?.canPublish));
  const streamingUsers=(media?.users||[]).filter(user=>Boolean(user.micOn||user.cameraOn));
  return (
    <>
      <header className="class-room-controls">
        <nav aria-label={lang==="zh"?"课程教室操作":"Course room actions"}>
          {showDevices&&<>
          <button
            className={
              (pendingMedia?.mic ?? mic)
                ? !pendingMedia && micLive
                  ? "on"
                  : "pending"
                : ""
            }
            disabled={changingMedia}
            aria-busy={Boolean(pendingMedia?.mic)}
            aria-pressed={!pendingMedia && micLive}
            onClick={() => void change(!mic, camera)}
            aria-label={lang === "zh" ? "麦克风" : "Microphone"}
          >
            <MicIcon />
          </button>
          {room.streamingMode === "video" && (
            <button
              className={
                (pendingMedia?.camera ?? camera)
                  ? !pendingMedia && cameraLive
                    ? "on"
                    : "pending"
                  : ""
              }
              disabled={changingMedia}
              aria-busy={Boolean(pendingMedia?.camera)}
              aria-pressed={!pendingMedia && cameraLive}
              onClick={() => void change(mic, !camera)}
              aria-label={lang === "zh" ? "摄像头" : "Camera"}
            >
              <CameraIcon />
            </button>
          )}
          </>}
          {COLLABORATION_SHARE_CONTROLS_VISIBLE && <>{room.streamingMode === "audio" &&
          room.realtimeMode !== "livestream" ? (
            <ClassAudioScreenShare
              code={room.code}
              displayName={displayName}
              manager={manager}
              parentSessionToken={sessionToken}
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
              onSharingChange={(sharing) => {
                void fetch(`/api/classrooms/${room.code}/media`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    action: "screen-share",
                    identity,
                    sessionToken,
                    value: sharing,
                  }),
                  keepalive: !sharing,
                }).catch(() => undefined);
                if (sharing) {
                  cameraBeforeScreenShare.current = camera;
                  if (camera) void change(mic, false);
                } else if (cameraBeforeScreenShare.current) {
                  cameraBeforeScreenShare.current = false;
                  void change(mic, true);
                }
              }}
            />
          )}{" "}
          {room.streamingMode === "video" && (
            <ClassVideoContentShare
              client={client}
              code={room.code}
              identity={identity}
              sessionToken={sessionToken}
              mic={mic}
              camera={camera}
              manager={manager}
              lang={lang}
              onError={setError}
              onMedia={change}
              apiBase="/api/classrooms"
            />
          )}</>}
          <button
            className={
              listening ? (playbackConfirmed ? "on" : "pending") : ""
            }
            onClick={() => {
              setListening((value) => {onListeningChange(!value);return !value;});
              setBlocked(false);
            }}
            aria-label={lang === "zh" ? "扬声器" : "Device speaker"}
          >
            <SpeakerIcon off={!listening} />
            {listening&&playbackConfirmed&&<span>{formatConnectionDuration(connectedSeconds)}</span>}
            {listening&&!playbackConfirmed&&<span>{onlineMembers.length<2?(lang==="zh"?"等待加入":"Waiting for joining"):(lang==="zh"?"连接音频中":"Connecting audio")}</span>}
          </button>
          <button type="button" aria-label={lang==="zh"?"课程录音":"Course recordings"} title={lang==="zh"?"课程录音":"Course recordings"} disabled={resourceBusy&&roomPanel==="files"} onClick={()=>setRoomPanel(current=>resourceBusy?"recordings":current==="recordings"?null:"recordings")}><AudioFileIcon/></button>
          <button type="button" aria-label={lang==="zh"?"课程附件":"Course attachments"} title={lang==="zh"?"课程附件":"Course attachments"} disabled={resourceBusy&&roomPanel==="recordings"} onClick={()=>setRoomPanel(current=>current==="files"?null:"files")}><PaperclipIcon/></button>
          <button type="button" aria-label={lang==="zh"?"在线成员":"Online members"} title={lang==="zh"?"在线成员":"Online members"} disabled={resourceBusy&&roomPanel==="recordings"} onClick={()=>setRoomPanel(current=>current==="users"?null:"users")}><UsersIcon/></button>
          <button className="leave" onClick={() => setConfirmLeave(true)} aria-label={lang==="zh"?"离开课程教室":"Leave course room"} title={lang==="zh"?"离开课程教室":"Leave course room"}><HangupIcon/></button>
        </nav>
      </header>
      {streamingUsers.length>0&&<div className="class-streaming-members" aria-label={lang==="zh"?"正在直播的成员":"Streaming members"}>{streamingUsers.map(user=><button type="button" key={user.identity||user.displayName} onClick={()=>onMention(user.displayName)} title={user.displayName}>{user.displayName.slice(0,6)}</button>)}</div>}
      {room.streamingMode==="audio"&&room.realtimeMode==="group_call"&&<RoomPresenceTicker scope={room.code} events={roomPresenceEvents} fallback={lang==="zh"?"等待成员加入课程教室":"Waiting for members to join the course room"}/>}
      {confirmLeave && (
        <div className="media-idle-backdrop" role="presentation">
          <section className="media-idle-dialog" role="dialog" aria-modal="true">
            <h2>{lang === "zh" ? "离开课程？" : "Leave the course room?"}</h2>
            <div className="media-idle-actions">
              <button type="button" onClick={() => setConfirmLeave(false)}>{lang === "zh" ? "继续" : "Continue"}</button>
              <button type="button" className="danger" onClick={onLeave}>{lang === "zh" ? "离开" : "Leave"}</button>
            </div>
          </section>
        </div>
      )}
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
      {roomPanel==="users"&&<aside className="class-room-drawer" aria-label={lang==="zh"?"在线成员":"Online members"}><header><h2>{lang==="zh"?`在线成员 · ${onlineMembers.length}`:`Online members · ${onlineMembers.length}`}</h2><button type="button" onClick={()=>setRoomPanel(null)} aria-label={lang==="zh"?"关闭":"Close"}>×</button></header><div className="class-room-drawer-list">{onlineMembers.map(member=><button type="button" key={member.userId} onClick={()=>{onMention(member.displayName);setRoomPanel(null);}}>{member.displayName}</button>)}</div></aside>}
      <ClassRoomResources code={room.code} lang={lang} manager={manager} roomTabId={roomTabId}
        selfStreaming={micLive||cameraLive||Boolean(client.self.screenShareEnabled)} panel={roomPanel==="users"?null:roomPanel}
        onClose={()=>setRoomPanel(null)} onLocalNoteBusyChange={onLocalNoteBusyChange}
        providerRecordings={recordings} providerRecordingActive={recordingActive}
        providerRecordingBusy={recordingBusy} onProviderRecording={action=>void changeRecording(action)}
        onDeleteProviderRecording={id=>void deleteRecording(id)}/>
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
          onBlocked={onPlaybackBlocked}
          onPlaybackChange={onPlaybackChange}
        />
      ) : (
        <>
          <ParticipantsAudio
            client={client}
            enabled={listening}
            onBlocked={onPlaybackBlocked}
            onPlaybackChange={onPlaybackChange}
          />
          {room.streamingMode === "video" && (
            <VideoGrid
              client={client}
              localName={displayName}
              mediaUsers={media?.users || []}
              showLocalVideo={onlineMembers.length>1}
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
    [role, setRole] = useState<Role>("viewer"),
    [mic, setMic] = useState(false),
    [camera, setCamera] = useState(false),
    [sessionToken, setSessionToken] = useState(""),
    [identity] = useState(() => crypto.randomUUID()),
    [roomTabId] = useState(() => crypto.randomUUID()),
    [roomPresenceReady,setRoomPresenceReady] = useState(false),
    [onlineMembers,setOnlineMembers] = useState<OnlineMember[]>([]),
    [roomPresenceEvents,setRoomPresenceEvents] = useState<RoomPresenceEvent[]>([]),
    [waitingMedia,setWaitingMedia] = useState<{mic:boolean;camera:boolean}|null>(null),
    [listenEnabled,setListenEnabled] = useState(true),
    [resourceBusy,setResourceBusy] = useState(false),
    [waitingPanel,setWaitingPanel] = useState<"users"|"recordings"|"files"|null>(null),
    [entryPassword] = useState(() => { try { return String(JSON.parse(sessionStorage.getItem(`class-entry-${room.code}`) || "{}").password || ""); } catch { return ""; } }),
    [error, setError] = useState(""),
    [connecting, setConnecting] = useState(false),
    [playlistEnabled, setPlaylistEnabled] = useState(false),
    [, setHostOnline] = useState(manager),
    [humanStreamActive, setHumanStreamActive] = useState(false),
    [hasAnyPublisher,setHasAnyPublisher] = useState(false),
    [humanStreamSeen, setHumanStreamSeen] = useState(false),
    [localTrackHealth, setLocalTrackHealth] = useState({
      audio: false,
      video: false,
    }),
    joining = useRef(false),
    mediaOperationBusy = useRef(false),
    mediaIntent = useRef({ mic: false, camera: false }),
    presenceSeen = useRef<Map<string,string>|null>(null),
    presenceSequence = useRef(0),
    chatRef = useRef<ClassroomSupportChatHandle>(null);
  const postRoomPresence=useCallback((action:"heartbeat"|"leave"="heartbeat")=>fetch(`/api/classrooms/${room.code}/room-presence`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,tabId:roomTabId}),keepalive:true,
  }),[room.code,roomTabId]);
  useEffect(()=>{
    let stopped=false,timer=0;
    const heartbeat=async()=>{
      try{
        const response=await postRoomPresence();
        if(stopped)return;
        if(response.status===409){
          window.alert(lang==="zh"?"此账号已在该课程教室中，请先从另一设备离开。":"This account is already in this course room. Leave on the other device first.");
          window.location.replace(`/${lang}/classrooms/${room.code}`);return;
        }
        if(response.status===401){window.location.replace(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/classrooms/${room.code}/room`)}`);return;}
        if(response.status===403){window.location.replace(`/${lang}/classrooms/${room.code}`);return;}
        if(response.ok){
          const data=await response.json() as {users:OnlineMember[]};
          setOnlineMembers(data.users||[]);setRoomPresenceReady(true);
        }
      }catch{/* Keep a transient network gap from ending the room. */}
      if(!stopped)timer=window.setTimeout(()=>void heartbeat(),5000);
    };
    const pagehide=(event:PageTransitionEvent)=>{
      if(event.persisted)return;
      const body=new Blob([JSON.stringify({action:"leave",tabId:roomTabId})],{type:"application/json"});
      if(!navigator.sendBeacon(`/api/classrooms/${room.code}/room-presence`,body))void postRoomPresence("leave").catch(()=>undefined);
    };
    void heartbeat();window.addEventListener("pagehide",pagehide);
    return()=>{stopped=true;window.clearTimeout(timer);window.removeEventListener("pagehide",pagehide);void postRoomPresence("leave").catch(()=>undefined);};
  },[lang,postRoomPresence,room.code,roomTabId]);
  useEffect(()=>{
    const next=new Map(onlineMembers.map(member=>[member.userId,member.displayName]));
    if(presenceSeen.current){
      const changes=roomPresenceChanges(presenceSeen.current,next,presenceSequence.current,lang==="zh");
      if(changes.length){presenceSequence.current=changes.at(-1)!.sequence;setRoomPresenceEvents(current=>[...current,...changes].slice(-20));}
    }
    presenceSeen.current=next;
  },[lang,onlineMembers]);
  useEffect(() => {
    mediaIntent.current = { mic, camera };
  }, [camera, mic]);
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
          body: JSON.stringify({ action: "leave", identity, sessionToken }),
          keepalive: true,
        }).catch(() => undefined);
      setMic(false);
      setCamera(false);
      mediaIntent.current = { mic: false, camera: false };
      setLocalTrackHealth({ audio: false, video: false });
      setJoined(false);
      setSessionToken("");
    },
    [client, identity, room.code, room.realtimeMode, sessionToken],
  );
  const connect = useCallback(
    async ({
      start = false,
      publish = false,
      nextMic = false,
      nextCamera = false,
      preparedAudioTrack,
      preparedVideoTrack,
    }: {
      start?: boolean;
      publish?: boolean;
      nextMic?: boolean;
      nextCamera?: boolean;
      preparedAudioTrack?: MediaStreamTrack;
      preparedVideoTrack?: MediaStreamTrack;
    } = {}) => {
      if (joining.current) return;
      joining.current = true;
      setConnecting(true);
      setError("");
      let provisionalSessionToken = "";
      try {
        // Report the replaced viewer session before rotating to a publisher
        // session. Otherwise the old D1 presence row remains active until its
        // heartbeat expires and the room briefly shows a ghost participant.
        if (client && joined) await disconnect(true);
        const response = await fetch(`/api/classrooms/${room.code}/join`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              displayName,
              identity,
              roomTabId,
              password: entryPassword,
              start,
              publish,
              sessionToken,
              mic: nextMic,
              camera: nextCamera,
            }),
          }),
          data = (await response.json().catch(() => ({}))) as {
            authToken?: string;
            sessionToken?: string;
            role?: Role;
            error?: string;
          };
        provisionalSessionToken = data.sessionToken || "";
        if (!response.ok || !data.authToken || !data.sessionToken) {
          if (provisionalSessionToken)
            setSessionToken(provisionalSessionToken);
          if (data.error !== "STREAM_NOT_ACTIVE" && data.error !== "WAITING_FOR_MEMBER")
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
        setSessionToken(data.sessionToken);
        const approval = await fetch(`/api/classrooms/${room.code}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "media",
            identity,
            sessionToken: data.sessionToken,
            mic: nextMic,
            camera: nextCamera,
            authorizeOnly: true,
          }),
        });
        if (!approval.ok)
          throw new Error(
            ((await approval.json().catch(() => ({}))) as { error?: string })
              .error || "Media permission denied",
          );
        if (nextMic) await next?.self.enableAudio(preparedAudioTrack);
        if (nextCamera) await next?.self.enableVideo(preparedVideoTrack);
        await fetch(`/api/classrooms/${room.code}/media`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "media",
            identity,
            sessionToken: data.sessionToken,
            mic: nextMic,
            camera: nextCamera,
          }),
        });
        setRole(data.role || "viewer");
        setMic(nextMic);
        setCamera(nextCamera);
        mediaIntent.current = { mic: nextMic, camera: nextCamera };
        setLocalTrackHealth({
          audio: publishedLocalTrackIsLive(next?.self, "audio"),
          video: publishedLocalTrackIsLive(next?.self, "video"),
        });
        setJoined(true);
        setWaitingMedia(null);
      } catch (issue) {
        preparedAudioTrack?.stop();
        preparedVideoTrack?.stop();
        if (provisionalSessionToken)
          await fetch(`/api/classrooms/${room.code}/media`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "leave",
              identity,
              sessionToken: provisionalSessionToken,
            }),
            keepalive: true,
          }).catch(() => undefined);
        // Keep the rotated device secret after releasing a provisional
        // provider participant so a bounded retry can reclaim the same local
        // identity without making that identity forgeable by another tab.
        if (provisionalSessionToken) setSessionToken(provisionalSessionToken);
        setError(
          issue instanceof Error
            ? issue.message
            : "Live media connection failed.",
        );
        setWaitingMedia(null);
      } finally {
        joining.current = false;
        setConnecting(false);
      }
    },
    [client, disconnect, displayName, entryPassword, identity, initClient, joined, room.code, roomTabId, sessionToken],
  );
  const changeMedia = useCallback(
    async (nextMic: boolean, nextCamera: boolean) => {
      if (mediaOperationBusy.current) return;
      if (!joined && (!roomPresenceReady || onlineMembers.length < 2)) {
        const next={mic:nextMic,camera:nextCamera};
        mediaIntent.current=next;
        setWaitingMedia(nextMic||nextCamera?next:null);
        return;
      }
      mediaOperationBusy.current = true;
      try {
      const addingSecondDevice = Boolean(
        client && joined &&
          ((nextMic && !mic && camera) || (nextCamera && !camera && mic)),
      );
      if (addingSecondDevice) {
        const permission = await navigator.mediaDevices.getUserMedia({
          audio: nextMic,
          video: nextCamera ? { facingMode: "user" } : false,
        });
        await connect({ publish: true, nextMic, nextCamera, preparedAudioTrack: permission.getAudioTracks()[0], preparedVideoTrack: permission.getVideoTracks()[0] });
        return;
      }
      if (role === "viewer" && (nextMic || nextCamera)) {
        const permission = await navigator.mediaDevices.getUserMedia({
          audio: nextMic,
          video: nextCamera ? { facingMode: "user" } : false,
        });
        await connect({ publish: true, nextMic, nextCamera, preparedAudioTrack: permission.getAudioTracks()[0], preparedVideoTrack: permission.getVideoTracks()[0] });
        return;
      }
      if (room.realtimeMode === "webinar" && !manager && role === "member"
        && ((nextMic && !mic) || (nextCamera && !camera))) {
        const permission = await navigator.mediaDevices.getUserMedia({
          audio: nextMic,
          video: nextCamera ? { facingMode: "user" } : false,
        });
        await connect({
          publish: true,
          nextMic,
          nextCamera,
          preparedAudioTrack: permission.getAudioTracks()[0],
          preparedVideoTrack: permission.getVideoTracks()[0],
        });
        return;
      }
      const approval = await fetch(`/api/classrooms/${room.code}/media`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "media",
          identity,
          sessionToken,
          mic: nextMic,
          camera: nextCamera,
          authorizeOnly: true,
        }),
      });
      if (!approval.ok)
        throw new Error(
          ((await approval.json().catch(() => ({}))) as { error?: string })
            .error || "Unable to change media",
        );
      const audioTrack = client?.self.audioTrack,
        videoTrack = client?.self.videoTrack;
      let permission: MediaStream | undefined;
      if ((nextMic && !mic) || (nextCamera && !camera))
        permission = await navigator.mediaDevices.getUserMedia({
          audio: nextMic && !mic,
          video: nextCamera && !camera ? { facingMode: "user" } : false,
        });
      if (nextMic && !mic)
        await client?.self.enableAudio(permission?.getAudioTracks()[0]);
      else {
        if (!nextMic && mic) {
          await client?.self.disableAudio();
          audioTrack?.stop();
        }
      }
      if (nextCamera && !camera)
        await client?.self.enableVideo(permission?.getVideoTracks()[0]);
      else {
        if (!nextCamera && camera) {
          await client?.self.disableVideo();
          videoTrack?.stop();
        }
      }
      const response = await fetch(`/api/classrooms/${room.code}/media`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "media", identity, sessionToken, mic: nextMic, camera: nextCamera }),
      });
      if (!response.ok) throw new Error("Unable to synchronize media state");
      setMic(nextMic);
      setCamera(nextCamera);
      mediaIntent.current = { mic: nextMic, camera: nextCamera };
      setLocalTrackHealth({
        audio: publishedLocalTrackIsLive(client?.self, "audio"),
        video: publishedLocalTrackIsLive(client?.self, "video"),
      });
      } finally {
        mediaOperationBusy.current = false;
      }
    },
    [camera, client, connect, identity, joined, manager, mic, onlineMembers.length, role, room.code, room.realtimeMode, roomPresenceReady, sessionToken],
  );
  useEffect(()=>{
    if(!roomPresenceReady||onlineMembers.length<2||!waitingMedia||joined||joining.current||resourceBusy)return;
    void connect({start:manager,publish:true,nextMic:waitingMedia.mic,nextCamera:waitingMedia.camera});
  },[connect,joined,manager,onlineMembers.length,resourceBusy,roomPresenceReady,waitingMedia]);
  useEffect(()=>{
    if(!roomPresenceReady||!joined||onlineMembers.length>1||resourceBusy)return;
    const timer=window.setTimeout(()=>{
      const intent={...mediaIntent.current};
      void disconnect(true).then(()=>{
        if(intent.mic||intent.camera)setWaitingMedia(intent);
      });
    },9000);
    return()=>window.clearTimeout(timer);
  },[disconnect,joined,onlineMembers.length,resourceBusy,roomPresenceReady]);
  useEffect(()=>{
    if(!joined||mic||camera||hasAnyPublisher||playlistEnabled||resourceBusy)return;
    const timer=window.setTimeout(()=>void disconnect(true),15000);
    return()=>window.clearTimeout(timer);
  },[camera,disconnect,hasAnyPublisher,joined,mic,playlistEnabled,resourceBusy]);
  useEffect(() => {
    if (!joined || !client) {
      setLocalTrackHealth({ audio: false, video: false });
      return;
    }
    const monitor = createLocalMediaHealthMonitor({
      snapshot: () => ({
        audio: { expected: !mediaOperationBusy.current && mediaIntent.current.mic, live: publishedLocalTrackIsLive(client.self, "audio") },
        video: { expected: !mediaOperationBusy.current && mediaIntent.current.camera, live: publishedLocalTrackIsLive(client.self, "video") },
      }),
      onHealth: (health) => setLocalTrackHealth((current) =>
        current.audio === health.audio.live && current.video === health.video.live
          ? current : { audio: health.audio.live, video: health.video.live }),
      onStale: async (kinds) => {
        if (mediaOperationBusy.current) return;
        const next = { ...mediaIntent.current };
        for (const kind of kinds) {
          if (kind === "audio") { await client.self.disableAudio().catch(() => undefined); client.self.audioTrack?.stop(); next.mic = false; }
          else { await client.self.disableVideo().catch(() => undefined); client.self.videoTrack?.stop(); next.camera = false; }
        }
        mediaIntent.current = next;
        setMic(next.mic); setCamera(next.camera);
        setLocalTrackHealth({ audio: publishedLocalTrackIsLive(client.self, "audio"), video: publishedLocalTrackIsLive(client.self, "video") });
        await fetch(`/api/classrooms/${room.code}/media`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "media", identity, sessionToken, mic: next.mic, camera: next.camera }),
        }).catch(() => undefined);
        setError(lang === "zh" ? "麦克风或摄像头实时轨道已中断；按钮已同步为关闭，请再次点击恢复。" : "A microphone or camera track stopped. Its control is now off; tap it again to restore.");
      },
    });
    const reconcile = () => void monitor.reconcile();
    client.self.on("audioUpdate", reconcile); client.self.on("videoUpdate", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    const timer = window.setInterval(reconcile, 2_000), first = window.setTimeout(reconcile, 0);
    return () => {
      monitor.stop(); window.clearTimeout(first); window.clearInterval(timer);
      client.self.off("audioUpdate", reconcile); client.self.off("videoUpdate", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [client, identity, joined, lang, room.code, sessionToken]);
  const reportLeave = useCallback(() => {
    void fetch(`/api/classrooms/${room.code}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "leave", identity, sessionToken }),
      keepalive: true,
    }).catch(() => undefined);
  }, [identity, room.code, sessionToken]);
  const leave = useCallback(async () => {
    await disconnect(true);
    window.location.assign(`/${lang}/classrooms/${room.code}`);
  }, [disconnect, lang, room.code]);
  useEffect(() => {
    let alive = true;
    let timer = 0;
    let failures = 0;
    let checking = false;
    const check = async () => {
      if (!alive || checking) return;
      checking = true;
      try {
        const [mediaResponse, playlistResponse] = await Promise.all([
          fetch(`/api/classrooms/${room.code}/media?identity=${encodeURIComponent(identity)}`, {
            cache: "no-store",
            headers: sessionToken ? { "x-class-session-token": sessionToken } : {},
          }),
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
        failures = mediaResponse.ok ? 0 : failures + 1;
        setPlaylistEnabled(active);
        if (mediaState) {
          setHostOnline(Boolean(mediaState.hostOnline) || manager);
          const nextHumanStreamActive = Boolean(
            mediaState.users?.some((user) =>
              Boolean(user.micOn || user.cameraOn),
            ),
          );
          setHumanStreamActive(nextHumanStreamActive);
          setHasAnyPublisher(nextHumanStreamActive);
          if (nextHumanStreamActive) setHumanStreamSeen(true);
        }
        if (mediaState && roomPresenceReady && onlineMembers.length>1 && !resourceBusy &&
          shouldAutoJoinClassRoom(mediaState) && (mediaState.users?.some(user=>Boolean(user.micOn||user.cameraOn))||active||mediaState.screenShareActive) &&
          !joined && !joining.current && !waitingMedia)
          void connect();
        if (mediaState && !mediaState.streamActive && joined && !manager && !resourceBusy)
          void disconnect(true);
      } catch {
        failures += 1;
      } finally {
        checking = false;
        if (alive)
          timer = window.setTimeout(check, classPollDelay({
            kind: "media",
            joined,
            moderator: manager,
            hidden: document.hidden,
            failures,
            jitter: Math.random(),
          }));
      }
    };
    void check();
    const visible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      void check();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [connect, disconnect, identity, joined, manager, onlineMembers.length, resourceBusy, room.code, roomPresenceReady, sessionToken, waitingMedia]);
  useEffect(() => {
    const cleanup = () => {
      const body = new Blob([JSON.stringify({ action: "leave", identity, sessionToken })], {
        type: "application/json",
      });
      if (!navigator.sendBeacon(`/api/classrooms/${room.code}/media`, body))
        reportLeave();
      void disconnect(false);
    };
    window.addEventListener("pagehide", cleanup);
    return () => window.removeEventListener("pagehide", cleanup);
  }, [disconnect, identity, reportLeave, room.code, sessionToken]);
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
  const waitingCopy = classRoomWaitingCopy(lang, connecting, manager);
  if (!joined || !client)
    return (
      <>
        {managerPanel}
        {waitingPlaylist}
        <header className="class-room-controls"><nav aria-label={lang==="zh"?"课程教室操作":"Course room actions"}>
          {(manager||room.realtimeMode==="group_call")&&<>
            <button type="button" className={waitingMedia?.mic?"pending":""} disabled={connecting||!roomPresenceReady} onClick={()=>void changeMedia(!waitingMedia?.mic,Boolean(waitingMedia?.camera))} aria-label={lang==="zh"?"麦克风":"Microphone"}><MicIcon/></button>
            {room.streamingMode==="video"&&<button type="button" className={waitingMedia?.camera?"pending":""} disabled={connecting||!roomPresenceReady} onClick={()=>void changeMedia(Boolean(waitingMedia?.mic),!waitingMedia?.camera)} aria-label={lang==="zh"?"摄像头":"Camera"}><CameraIcon/></button>}
          </>}
          <button type="button" className={listenEnabled?"pending":""} onClick={()=>setListenEnabled(current=>!current)} aria-label={lang==="zh"?"扬声器":"Device speaker"} title={lang==="zh"?"等待加入":"Waiting for joining"}><SpeakerIcon off={!listenEnabled}/>{listenEnabled&&<span>{lang==="zh"?"等待加入":"Waiting for joining"}</span>}</button>
          <button type="button" disabled={resourceBusy&&waitingPanel==="files"} onClick={()=>setWaitingPanel(current=>resourceBusy?"recordings":current==="recordings"?null:"recordings")} aria-label={lang==="zh"?"课程录音":"Course recordings"}><AudioFileIcon/></button>
          <button type="button" disabled={resourceBusy&&waitingPanel==="recordings"} onClick={()=>setWaitingPanel(current=>current==="files"?null:"files")} aria-label={lang==="zh"?"课程附件":"Course attachments"}><PaperclipIcon/></button>
          <button type="button" disabled={resourceBusy&&waitingPanel==="recordings"} onClick={()=>setWaitingPanel(current=>current==="users"?null:"users")} aria-label={lang==="zh"?"在线成员":"Online members"}><UsersIcon/></button>
          <button type="button" className="leave" onClick={()=>void leave()} aria-label={lang==="zh"?"离开课程教室":"Leave course room"}><HangupIcon/></button>
        </nav></header>
        {waitingPanel==="users"&&<aside className="class-room-drawer" aria-label={lang==="zh"?"在线成员":"Online members"}><header><h2>{lang==="zh"?`在线成员 · ${onlineMembers.length}`:`Online members · ${onlineMembers.length}`}</h2><button type="button" onClick={()=>setWaitingPanel(null)} aria-label={lang==="zh"?"关闭":"Close"}>×</button></header><div className="class-room-drawer-list">{onlineMembers.map(member=><button type="button" key={member.userId} onClick={()=>{chatRef.current?.mention(member.displayName);setWaitingPanel(null);}}>{member.displayName}</button>)}</div></aside>}
        <ClassRoomResources code={room.code} lang={lang} manager={manager} roomTabId={roomTabId} selfStreaming={false}
          panel={waitingPanel==="users"?null:waitingPanel} onClose={()=>setWaitingPanel(null)} onLocalNoteBusyChange={setResourceBusy}/>
        {room.streamingMode==="audio"&&room.realtimeMode==="group_call"&&<RoomPresenceTicker scope={room.code} events={roomPresenceEvents} fallback={lang==="zh"?"等待成员加入课程教室":"Waiting for members to join the course room"}/>}
        <section className="class-waiting">
          {connecting&&<span className="stream-spinner" />}
          <h2>{waitingMedia?(lang==="zh"?"等待其他成员加入":"Waiting for another member"):waitingCopy.title}</h2>
          <p>{waitingCopy.description}</p>
          {error && <p role="alert">{error}</p>}
        </section>
        <section className="class-chat class-support-chat"><header><h2>{lang==="zh"?"私密支持聊天":"Private support chat"}</h2><span>{lang==="zh"?"仅发送者与主持团队可见":"Only sender and host team can see"}</span></header>{roomPresenceReady&&<ClassroomSupportChat ref={chatRef} code={room.code} locale={lang} supportAgent={manager} reportError={setError}/>}</section>
      </>
    );
  return (
    <>
      {managerPanel}
      {waitingPlaylist}
      <RealtimeKitProvider value={client}>
        <ConnectedRoom
          client={client}
          room={room}
          identity={identity}
          sessionToken={sessionToken}
          manager={manager}
          displayName={displayName}
          role={role}
          mic={mic}
          camera={camera}
          micLive={localTrackHealth.audio}
          cameraLive={localTrackHealth.video}
          onlineMembers={onlineMembers}
          roomPresenceEvents={roomPresenceEvents}
          roomTabId={roomTabId}
          resourceBusy={resourceBusy}
          onLocalNoteBusyChange={setResourceBusy}
          onMention={name=>chatRef.current?.mention(name)}
          initialListening={listenEnabled}
          onListeningChange={setListenEnabled}
          lang={lang}
          onMedia={changeMedia}
          onLeave={() => void leave()}
        />
      </RealtimeKitProvider>
      <section className="class-chat class-support-chat"><header><h2>{lang==="zh"?"私密支持聊天":"Private support chat"}</h2><span>{lang==="zh"?"仅发送者与主持团队可见":"Only sender and host team can see"}</span></header>{roomPresenceReady&&<ClassroomSupportChat ref={chatRef} code={room.code} locale={lang} supportAgent={manager} reportError={setError}/>}</section>
    </>
  );
}
