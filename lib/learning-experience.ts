import { getDatabase } from "./auth";
import { joinedLanguageCodes } from "./learning-language-codes";

/** Read existing learning plans and course memberships; no parallel language table. */
export async function memberLearningLanguages(userId: string) {
  const database = getDatabase();
  const [plans, courses] = await Promise.all([
    database.prepare("SELECT target_language AS code FROM smartlingo_learning_plans WHERE user_id=? ORDER BY updated_at DESC")
      .bind(userId).run<{ code: string }>(),
    database.prepare(`SELECT DISTINCT c.target_language AS code FROM smartlingo_language_classes c
      JOIN smartlingo_language_class_members m ON m.class_id=c.id
      WHERE m.user_id=? AND m.status='active' AND c.status='open' AND c.class_kind='official_course'`)
      .bind(userId).run<{ code: string }>(),
  ]);
  return joinedLanguageCodes([...(plans.results ?? []), ...(courses.results ?? [])].map(row => row.code));
}
