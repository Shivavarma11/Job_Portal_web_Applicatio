import { AuthenticatedRequest } from "../middleware/auth.js";
import ErrorHandler from "../utils/errorHandler.js";
import { sql } from "../utils/db.js";
import { TryCatch } from "../utils/TryCatch.js";
import axios from "axios";
import getBuffer from "../utils/buffer.js";


export const createCompany = TryCatch(async(req: AuthenticatedRequest,res)=>{
    const user = req.user;

    if(!user){
        throw new ErrorHandler(401,"Unauthorized");
    }

    if(user?.role!== "recruiter"){
        throw new ErrorHandler(403,"Forbidden :Only recruiters can create a company profile")
    }

    const {name ,description,website} = req.body;

    if(!name || !description || !website){
        throw new ErrorHandler(400,"Please fill all details");
    }

    const existingCompanies = await sql`SELECT company_id FROM companies WHERE name = ${name}`;

    if(existingCompanies.length > 0){
        throw new ErrorHandler(409,`Company with this ${name} already exists`);
    }

    const file = req.file;

    const fileBuffer = getBuffer(file);

    if(!fileBuffer || !fileBuffer.content){
        throw new ErrorHandler(400,"Company logo is required");
    }

    const {data} = await axios.post(`${process.env.UPLOAD_SERVICE}/api/utils/upload`,{
        buffer : fileBuffer.content
    })

    const [newCompany] = await sql`
    INSERT INTO companies (name,description,website,logo,logo_public_id,recruiter_id)
    VALUES (${name},${description},${website},${data.url},${data.public_id},${user.user_id})
    RETURNING *`;

    res.json({
        message : "Company profile created successfully",
        company : newCompany
    })

}) 

export const deleteCompany = TryCatch(async(req:AuthenticatedRequest,res)=>{

    const user =req.user;

    if(!user){
        throw new ErrorHandler(401,"Unauthorized");
    }
    const {companyId} = req.params;

    const [company] = await sql`
    SELECT logo_public_id FROM companies WHERE company_id = ${companyId} AND recruiter_id = ${user?.user_id}`;

    if(!company){
        throw new ErrorHandler(404,"Company not found or you are not authorized to delete this company");
    }


    await sql`
    DELETE FROM companies WHERE company_id = ${companyId}`;

    res.json({
        message : "Company and all associated jobs deleted successfully"
    })
 })


 export const createJob = TryCatch(async(req:AuthenticatedRequest,res)=>{
    const user = req.user;

    if(!user){
        throw new ErrorHandler(401,"Unauthorized");
    }

    if(user?.role !== "recruiter"){
        throw new ErrorHandler(403,"Forbidden :Only recruiters can create job postings");
    }

    const {title,description,salary,location,role,job_type,work_location,openings,company_id}=req.body;

    if(!title || !description || !role || !salary || !location || !openings){
        throw new ErrorHandler(400,"Please fill all required details");
    }

    const[company] = await sql`SELECT company_id FROM companies WHERE company_id = ${company_id} AND recruiter_id = ${user.user_id}`;

    if(!company){
        throw new ErrorHandler(404,"Company not found)");
    }

    const[newJob] = await sql`
    INSERT INTO jobs (title,description,salary,location,role,job_type,work_location,company_id,posted_by_recruiter_id,openings)
    VALUES (${title},${description},${salary},${location},${role},${job_type},${work_location},${company_id},${user.user_id},${openings}) RETURNING *`;


    res.json({
        message : "Job created successfully",
        job : newJob
    })

 })


 export const updateJob = TryCatch(async(req:AuthenticatedRequest,res)=>{
        const user = req.user;

        if(!user){
            throw new ErrorHandler(401,"Unauthorized")
        }

        const {title,description,salary,location,role,job_type,work_location,openings,is_active} = req.body;

        const[existingJob] = await sql`
        SELECT posted_by_recruiter_id FROM jobs WHERE job_id=${req.params.jobId}`;

        if(!existingJob){
            throw new ErrorHandler(401,"Job not found");
        }

        if(existingJob.posted_by_recruiter_id !== user.user_id){
            throw new ErrorHandler(401,"You are not the owner of this job posting")
        }

        const [updatedJob] = await sql`
        UPDATE jobs SET title = ${title},description = ${description},salary = ${salary},location = ${location},role=${role},job_type = ${job_type},work_location = ${work_location},openings = ${openings},is_active = ${is_active}
        WHERE job_id = ${req.params.jobId}
        RETURNING *`;

        res.json({
            message : "Job updated successfully",
            job : updateJob
        })
 })