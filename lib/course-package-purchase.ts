import { createId, getDatabase } from "./auth";
import {
  addCourseSubscriptionMonths,
  courseSubscriptionPackage,
  fixedCourseId,
  type SmartLingoCourseDurationMonths,
  type SmartLingoPackageTier,
} from "./smartlingo-course-packages";
import { ensureCourseLearningEnrollment } from "./course-learning-enrollment";
import {
  isSmartLingoCommunityLanguage,
  type SmartLingoCommunityLanguage,
} from "./smartlingo-language-communities";
import { eligibleCourseSupervisorByRefId } from "./course-supervisors";

export type CoursePackagePaymentProvider = "stripe" | "smartpay5";

type CourseRow = {
  id: string;
  targetLanguage: SmartLingoCommunityLanguage;
  packageTier: SmartLingoPackageTier;
};

type ExistingPurchase = {
  userId: string;
  classId: string;
  targetLanguage: SmartLingoCommunityLanguage;
  packageTier: SmartLingoPackageTier;
  durationMonths: SmartLingoCourseDurationMonths;
  accessStartsAt: number;
  accessEndsAt: number;
  status: string;
};

export async function recordCoursePackagePurchase(input: {
  userId: string;
  classId: string;
  targetLanguage: string;
  packageTier: SmartLingoPackageTier;
  durationMonths: SmartLingoCourseDurationMonths;
  priceCents: number;
  provider: CoursePackagePaymentProvider;
  providerReference: string;
  paidAt?: number;
  supervisorRefId?: string | null;
}) {
  const database = getDatabase();
  const providerReference = input.providerReference.trim();
  if (!providerReference) throw new Error("PAYMENT_REFERENCE_REQUIRED");
  if (!isSmartLingoCommunityLanguage(input.targetLanguage)) throw new Error("INVALID_TARGET_LANGUAGE");
  const selectedPackage = courseSubscriptionPackage(input.packageTier, input.durationMonths);
  if (!selectedPackage || selectedPackage.priceCents !== input.priceCents) throw new Error("PACKAGE_PRICE_MISMATCH");
  const expectedClassId = fixedCourseId(input.targetLanguage, input.packageTier);
  if (input.classId !== expectedClassId) throw new Error("COURSE_LANGUAGE_MISMATCH");
  const supervisor = input.supervisorRefId ? await eligibleCourseSupervisorByRefId(input.supervisorRefId) : null;
  if (input.supervisorRefId && !supervisor) throw new Error("INVALID_SUPERVISOR");
  if (supervisor?.userId === input.userId) throw new Error("SELF_SUPERVISION_NOT_ALLOWED");

  const existing = await database.prepare(`SELECT user_id AS userId,class_id AS classId,target_language AS targetLanguage,
    package_tier AS packageTier,duration_months AS durationMonths,access_starts_at AS accessStartsAt,
    access_ends_at AS accessEndsAt,status FROM smartlingo_course_package_purchases
    WHERE provider=? AND provider_reference=? LIMIT 1`).bind(input.provider, providerReference).first<ExistingPurchase>();
  if (existing) {
    if (existing.userId !== input.userId || existing.classId !== input.classId
      || existing.targetLanguage !== input.targetLanguage || existing.packageTier !== input.packageTier
      || existing.durationMonths !== input.durationMonths) throw new Error("PAYMENT_ALREADY_APPLIED_ELSEWHERE");
    if (existing.status !== "paid") throw new Error("PAYMENT_NOT_ACTIVE");
    await ensureCourseLearningEnrollment(database, { id: input.classId, targetLanguage: input.targetLanguage, packageTier: input.packageTier }, input.userId);
    return { alreadyRecorded: true, status: existing.status, accessStartsAt: existing.accessStartsAt, accessEndsAt: existing.accessEndsAt };
  }

  const course = await database.prepare(`SELECT id,target_language AS targetLanguage,package_tier AS packageTier
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' AND visibility='public' LIMIT 1`)
    .bind(input.classId).first<CourseRow>();
  if (!course || course.targetLanguage !== input.targetLanguage || course.packageTier !== input.packageTier) throw new Error("COURSE_UNAVAILABLE");

  const current = await database.prepare(`SELECT trial_ends_at AS trialEnds,current_period_ends_at AS periodEnds
    FROM smartlingo_course_subscriptions WHERE class_id=? AND user_id=? LIMIT 1`).bind(input.classId, input.userId)
    .first<{ trialEnds: number; periodEnds: number | null }>();
  const now = input.paidAt || Math.floor(Date.now() / 1000);
  const accessStartsAt = Math.max(now, Number(current?.trialEnds || 0), Number(current?.periodEnds || 0));
  const accessEndsAt = addCourseSubscriptionMonths(accessStartsAt, input.durationMonths);
  const purchaseId = createId();
  const statements = [
    database.prepare(`INSERT INTO smartlingo_course_package_purchases
      (id,user_id,class_id,target_language,package_id,package_tier,duration_months,price_cents,currency,provider,provider_reference,
       access_starts_at,access_ends_at,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?, 'USD',?,?,?,?,'paid',?,?)`)
      .bind(purchaseId,input.userId,input.classId,input.targetLanguage,selectedPackage.id,input.packageTier,input.durationMonths,
        input.priceCents,input.provider,providerReference,accessStartsAt,accessEndsAt,now,now),
    database.prepare(`INSERT INTO smartlingo_course_subscriptions
      (id,class_id,user_id,status,monthly_price_cents,trial_started_at,trial_ends_at,current_period_ends_at,supervisor_user_id,supervisor_ref_id,created_at,updated_at)
      VALUES(?,?,?,'active',?,?,?,?,?,?,?,?)
      ON CONFLICT(class_id,user_id) DO UPDATE SET status='active',monthly_price_cents=excluded.monthly_price_cents,
        trial_started_at=excluded.trial_started_at,trial_ends_at=excluded.trial_ends_at,
        current_period_ends_at=excluded.current_period_ends_at,
        supervisor_user_id=COALESCE(smartlingo_course_subscriptions.supervisor_user_id,excluded.supervisor_user_id),
        supervisor_ref_id=COALESCE(smartlingo_course_subscriptions.supervisor_ref_id,excluded.supervisor_ref_id),
        updated_at=excluded.updated_at`)
      .bind(createId(),input.classId,input.userId,input.priceCents,now,now,accessEndsAt,supervisor?.userId||null,supervisor?.refId||null,now,now),
    database.prepare(`INSERT INTO smartlingo_language_class_members(id,class_id,user_id,role,status,joined_at,updated_at)
      VALUES(?,?,?,'student','active',?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET role='student',status='active',updated_at=excluded.updated_at`)
      .bind(createId(),input.classId,input.userId,now,now),
  ];
  if (supervisor) statements.push(database.prepare(`INSERT INTO smartlingo_course_supervisor_reward_events
    (id,purchase_id,supervisor_user_id,subscriber_user_id,class_id,reward_basis_cents,reward_amount_cents,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,NULL,'eligible',?,?) ON CONFLICT(purchase_id) DO NOTHING`)
    .bind(createId(),purchaseId,supervisor.userId,input.userId,input.classId,input.priceCents,now,now));

  try {
    await database.batch(statements);
  } catch (error) {
    const concurrent = await database.prepare(`SELECT user_id AS userId,class_id AS classId,target_language AS targetLanguage,
      package_tier AS packageTier,duration_months AS durationMonths,access_starts_at AS accessStartsAt,
      access_ends_at AS accessEndsAt,status FROM smartlingo_course_package_purchases
      WHERE provider=? AND provider_reference=? LIMIT 1`).bind(input.provider, providerReference).first<ExistingPurchase>();
    if (concurrent?.userId === input.userId && concurrent.classId === input.classId
      && concurrent.targetLanguage === input.targetLanguage && concurrent.packageTier === input.packageTier
      && concurrent.durationMonths === input.durationMonths) {
      if (concurrent.status !== "paid") throw new Error("PAYMENT_NOT_ACTIVE");
      return { alreadyRecorded: true, status: concurrent.status, accessStartsAt: concurrent.accessStartsAt, accessEndsAt: concurrent.accessEndsAt };
    }
    throw error;
  }
  await ensureCourseLearningEnrollment(database, course, input.userId, now);
  return { alreadyRecorded: false, status: "paid", accessStartsAt, accessEndsAt };
}

export async function markCoursePackagePaymentStatus(providerReference: string, status: "refunded" | "disputed") {
  const now = Math.floor(Date.now() / 1000);
  const database = getDatabase();
  const purchase=await database.prepare(`SELECT id FROM smartlingo_course_package_purchases WHERE provider='stripe' AND provider_reference=? LIMIT 1`)
    .bind(providerReference).first<{id:string}>();
  if(!purchase)return;
  await database.batch([
    database.prepare(`UPDATE smartlingo_course_package_purchases SET status=?,updated_at=? WHERE id=?`).bind(status,now,purchase.id),
    database.prepare(`UPDATE smartlingo_course_supervisor_reward_events SET status='reversed',updated_at=? WHERE purchase_id=? AND status<>'reversed'`).bind(now,purchase.id),
  ]);
}
