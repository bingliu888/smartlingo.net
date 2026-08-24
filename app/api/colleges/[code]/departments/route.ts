import { getSessionUser } from "@/lib/auth";
import { createDepartment } from "@/lib/college-departments";
import { canManageCollege, collegeByCode } from "@/lib/smartlingo-colleges";

export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){
  const user=await getSessionUser(request);if(!user)return Response.json({error:"Authentication required"},{status:401});
  const college=await collegeByCode((await params).code);if(!college)return Response.json({error:"College not found"},{status:404});
  if(!canManageCollege(college,user))return Response.json({error:"College owner access required"},{status:403});
  const input=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!input)return Response.json({error:"Invalid request"},{status:400});
  try{return Response.json(await createDepartment(college,user,input),{status:201})}
  catch(error){const code=error instanceof Error?error.message:"";const status=code==="DEPARTMENT_LIMIT_REACHED"?409:code==="SUPERVISOR_LICENSE_REQUIRED"?403:400;
    const messages:Record<string,string>={INVALID_LANGUAGE_PAIR:"Choose two different supported languages",SUPERVISOR_LICENSE_REQUIRED:"College Supervisor license required",DEPARTMENT_LIMIT_REACHED:"Department limit reached",COURSE_BUNDLE_UNAVAILABLE:"The three admin courses are not ready for this language"};
    return Response.json({error:messages[code]||"Unable to create department"},{status});}
}
