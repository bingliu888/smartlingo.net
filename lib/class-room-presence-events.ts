export function roomPresenceChanges(
  previous: ReadonlyMap<string, string>,
  next: ReadonlyMap<string, string>,
  firstSequence: number,
  chinese: boolean,
) {
  let sequence = firstSequence;
  const events: { sequence: number; text: string }[] = [];
  for (const [id, name] of next) if (!previous.has(id))
    events.push({ sequence: ++sequence,
      text: chinese ? `${name} 进入了课程教室` : `${name} entered the course room` });
  for (const [id, name] of previous) if (!next.has(id))
    events.push({ sequence: ++sequence,
      text: chinese ? `${name} 离开了课程教室` : `${name} left the course room` });
  return events;
}
