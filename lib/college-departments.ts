import { createId, getDatabase, type SessionUser } from "./auth";
import { isPermanentAdmin } from "./admin-access";
import { generateClassCode } from "./live-classrooms";
import { departmentLanguagePair, isDepartmentLanguage, type DepartmentLanguage } from "./college-department-languages";
export { DEPARTMENT_LANGUAGES, departmentLanguageName, isDepartmentLanguage, type DepartmentLanguage } from "./college-department-languages";
export type CollegeDepartment = {
  id:string;code:string;collegeId:string;sourceLanguage:DepartmentLanguage;targetLanguage:DepartmentLanguage;
  titleEn:string;titleZh:string;status:string;roomCode:string;streamingMode:"audio"|"video";courseCount:number;
};
export type DepartmentCourse={id:string;title:string;summary:string;level:string;packageTier:string;priceCents:number;currency:string};

export async function supervisorLicense(userId:string){
  return getDatabase().prepare(`SELECT tier,price_cents AS priceCents,max_departments AS maxDepartments,status,
    (SELECT COUNT(*) FROM smartlingo_college_departments department JOIN smartlingo_colleges college ON college.id=department.college_id
      WHERE college.owner_user_id=? AND department.status='active') AS departmentCount
    FROM smartlingo_college_supervisor_licenses WHERE user_id=? LIMIT 1`).bind(userId,userId)
    .first<{tier:"basic"|"premium"|"supreme";priceCents:number;maxDepartments:number;status:string;departmentCount:number}>();
}

export async function collegeDepartments(collegeId:string){
  const result=await getDatabase().prepare(`SELECT department.id,department.code,department.college_id AS collegeId,
    department.source_language AS sourceLanguage,department.target_language AS targetLanguage,department.title_en AS titleEn,
    department.title_zh AS titleZh,department.status,room.code AS roomCode,room.streaming_mode AS streamingMode,
    (SELECT COUNT(*) FROM smartlingo_college_department_courses courses WHERE courses.department_id=department.id) AS courseCount
    FROM smartlingo_college_departments department
    JOIN smartlingo_department_classrooms mapping ON mapping.department_id=department.id
    JOIN live_class_rooms room ON room.id=mapping.room_id
    WHERE department.college_id=? AND department.status='active' ORDER BY department.created_at`).bind(collegeId).run<CollegeDepartment>();
  return result.results||[];
}

export async function departmentById(id:string){
  return getDatabase().prepare(`SELECT department.id,department.code,department.college_id AS collegeId,
    department.source_language AS sourceLanguage,department.target_language AS targetLanguage,department.title_en AS titleEn,
    department.title_zh AS titleZh,department.status,room.code AS roomCode,room.streaming_mode AS streamingMode,
    (SELECT COUNT(*) FROM smartlingo_college_department_courses courses WHERE courses.department_id=department.id) AS courseCount
    FROM smartlingo_college_departments department JOIN smartlingo_department_classrooms mapping ON mapping.department_id=department.id
    JOIN live_class_rooms room ON room.id=mapping.room_id WHERE department.id=? LIMIT 1`).bind(id).first<CollegeDepartment>();
}

export async function departmentCourses(departmentId:string){
  const result=await getDatabase().prepare(`SELECT course.id,course.title,course.summary,course.level,course.package_tier AS packageTier,
    course.price_cents AS priceCents,course.currency FROM smartlingo_college_department_courses mapping
    JOIN smartlingo_language_classes course ON course.id=mapping.course_id
    WHERE mapping.department_id=? AND course.class_kind='official_course' AND course.status='open'
    ORDER BY mapping.position`).bind(departmentId).run<DepartmentCourse>();return result.results||[];
}

async function departmentCode(){for(let i=0;i<40;i++){const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%100_000_000).padStart(8,"0");if(!await getDatabase().prepare("SELECT 1 FROM smartlingo_college_departments WHERE code=?").bind(code).first())return code}throw new Error("DEPARTMENT_CODE_UNAVAILABLE")}

export async function createDepartment(college:{id:string;ownerUserId:string;titleEn:string;titleZh:string},user:SessionUser,input:Record<string,unknown>){
  const source=input.sourceLanguage,target=input.targetLanguage;
  if(!isDepartmentLanguage(source)||!isDepartmentLanguage(target)||source===target)throw new Error("INVALID_LANGUAGE_PAIR");
  const permanentAdmin=isPermanentAdmin(user);
  const license=await supervisorLicense(user.id);
  if(!permanentAdmin&&(!license||license.status!=="active"))throw new Error("SUPERVISOR_LICENSE_REQUIRED");
  if(!permanentAdmin&&license&&license.departmentCount>=license.maxDepartments)throw new Error("DEPARTMENT_LIMIT_REACHED");
  const courses=(await getDatabase().prepare(`SELECT id,package_tier AS packageTier FROM smartlingo_language_classes
    WHERE class_kind='official_course' AND target_language=? AND status='open' AND visibility='public'
      AND package_tier IN ('basic','intermediate','advanced')
    ORDER BY CASE package_tier WHEN 'basic' THEN 0 WHEN 'intermediate' THEN 1 ELSE 2 END`).bind(target).run<{id:string;packageTier:string}>()).results||[];
  if(courses.length<3)throw new Error("COURSE_BUNDLE_UNAVAILABLE");
  const db=getDatabase(),now=Math.floor(Date.now()/1000),id=createId(),code=await departmentCode(),roomId=createId(),roomCode=await generateClassCode();
  const {titleEn,titleZh}=departmentLanguagePair(source,target);
  await db.batch([
    db.prepare(`INSERT INTO smartlingo_college_departments(id,code,college_id,source_language,target_language,title_en,title_zh,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,'active',?,?)`).bind(id,code,college.id,source,target,titleEn,titleZh,now,now),
    ...courses.map((course,index)=>db.prepare("INSERT INTO smartlingo_college_department_courses(department_id,course_id,position,created_at) VALUES(?,?,?,?)").bind(id,course.id,index,now)),
    db.prepare(`INSERT INTO live_class_rooms(id,code,host_user_id,host_email,host_name,title,description,subject,class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,trial_minutes,tuition_cents,mute_all,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?, 'private','audio','webinar',?,60,0,0,0,'active',?,?)`).bind(roomId,roomCode,college.ownerUserId,user.email,user.displayName,`${titleEn} Department Webinar`,`${college.titleEn} enrollment and student webinar room.`,`${target.toUpperCase()} department`,now,now,now),
    db.prepare("INSERT INTO smartlingo_department_classrooms(department_id,room_id,created_at) VALUES(?,?,?)").bind(id,roomId,now),
  ]);
  return {id,code,roomCode,courseCount:courses.length};
}
