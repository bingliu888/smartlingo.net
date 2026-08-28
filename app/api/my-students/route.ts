import { getDatabase, getSessionUser } from "@/lib/auth";
import { courseSupervisorIdentity } from "@/lib/course-supervisors";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const supervisor = await courseSupervisorIdentity(user.id, true);
  if (!supervisor) return Response.json({ error: "VIP or administrator access required" }, { status: 403 });
  const language = new URL(request.url).searchParams.get("language") || "";
  if (language && !isSmartLingoCommunityLanguage(language)) return Response.json({ error: "Invalid language" }, { status: 400 });
  const result = await getDatabase().prepare(`SELECT subscription.id,subscription.status,
    subscription.trial_ends_at AS trialEndsAt,subscription.current_period_ends_at AS currentPeriodEndsAt,
    course.id AS classId,course.title AS courseName,course.target_language AS targetLanguage,
    course.package_tier AS packageTier,learner.display_name AS subscriberName,learner.email AS subscriberEmail,
    subscription.supervisor_ref_id AS supervisorRefId,
    (SELECT COUNT(*) FROM smartlingo_course_supervisor_reward_events reward
      WHERE reward.supervisor_user_id=? AND reward.subscriber_user_id=subscription.user_id
        AND reward.class_id=subscription.class_id AND reward.status IN ('eligible','earned')) AS rewardEvents
    FROM smartlingo_course_subscriptions subscription
    JOIN smartlingo_language_classes course ON course.id=subscription.class_id
    JOIN users learner ON learner.id=subscription.user_id
    WHERE subscription.supervisor_user_id=? AND (?='' OR course.target_language=?)
    ORDER BY course.target_language,subscription.current_period_ends_at DESC,learner.display_name COLLATE NOCASE`)
    .bind(user.id,user.id,language,language).run();
  return Response.json({ supervisorRefId: supervisor.refId, rows: result.results || [] }, { headers: { "cache-control": "private, no-store" } });
}
