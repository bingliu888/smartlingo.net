import { getDatabase, getSessionUser } from "../../../../../lib/auth";
import { canManageCollege, collegeByCode } from "../../../../../lib/smartlingo-colleges";

export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){
  const user=await getSessionUser(request),college=await collegeByCode((await params).code);
  if(!college)return Response.json({error:"College not found"},{status:404});
  if(!canManageCollege(college,user))return Response.json({error:"Forbidden"},{status:403});
  const input=await request.json().catch(()=>null) as{courseId?:unknown}|null,courseId=String(input?.courseId||"").slice(0,100);
  const course=courseId?await getDatabase().prepare("SELECT id FROM smartlingo_language_classes WHERE id=? AND status='open' AND class_kind IN ('official_course','subject')").bind(courseId).first<{id:string}>():null;
  if(!course)return Response.json({error:"Course not found"},{status:404});
  try{await getDatabase().prepare("INSERT INTO smartlingo_college_courses(college_id,course_id,kind,position,created_at) VALUES(?,?,'standard',100,unixepoch())").bind(college.id,course.id).run();return Response.json({ok:true},{status:201});}
  catch{return Response.json({error:"This course already belongs to a college"},{status:409});}
}
