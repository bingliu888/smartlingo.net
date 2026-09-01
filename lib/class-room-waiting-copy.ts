export type ClassRoomWaitingLocale = "en" | "zh";

export function classRoomWaitingCopy(
  locale: ClassRoomWaitingLocale,
  connecting: boolean,
  manager: boolean,
) {
  if (locale === "zh") {
    return {
      title: connecting
        ? "正在连接…"
        : manager
          ? "开启实时课程教室"
          : "等待实时课程开始",
      description: manager
        ? "启动本站独立的实时媒体会话。只有在您选择后才会开启麦克风或摄像头。"
        : "直播开始后，您会自动以观众身份加入，且不会请求设备权限。",
    };
  }

  return {
    title: connecting
      ? "Connecting…"
      : manager
        ? "Start the live course room"
        : "Waiting for live course room",
    description: manager
      ? "Start this site's independent live media session. Microphone and camera remain off until selected."
      : "You join automatically as a viewer when streaming starts. No device permission is requested.",
  };
}
