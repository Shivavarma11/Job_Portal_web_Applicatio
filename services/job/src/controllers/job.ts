import { AuthenticatedRequest } from "../middleware/auth.js";
import ErrorHandler from "../utils/errorHandler.js";
import { sql } from "../utils/db.js";
import { TryCatch } from "../utils/TryCatch.js";
import axios from "axios";
import getBuffer from "../utils/buffer.js";
import app from "../app.js";
import { applicationStatusUpdateTemplate } from "../utils/template.js";
import { publishToTopic } from "../utils/producer.js";


export const createCompany = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
        throw new ErrorHandler(401, "Unauthorized");
    }

    if (user?.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden :Only recruiters can create a company profile")
    }

    const { name, description, website } = req.body;

    if (!name || !description || !website) {
        throw new ErrorHandler(400, "Please fill all details");
    }

    const existingCompanies = await sql`SELECT company_id FROM companies WHERE name = ${name}`;

    if (existingCompanies.length > 0) {
        throw new ErrorHandler(409, `Company with this ${name} already exists`);
    }

    const file = req.file;

    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
        throw new ErrorHandler(400, "Company logo is required");
    }

    const { data } = await axios.post(`${process.env.UPLOAD_SERVICE}/api/utils/upload`, {
        buffer: fileBuffer.content
    })

    const [newCompany] = await sql`
    INSERT INTO companies (name,description,website,logo,logo_public_id,recruiter_id)
    VALUES (${name},${description},${website},${data.url},${data.public_id},${user.user_id})
    RETURNING *`;

    res.json({
        message: "Company profile created successfully",
        company: newCompany
    })

})

export const deleteCompany = TryCatch(async (req: AuthenticatedRequest, res) => {

    const user = req.user;

    if (!user) {
        throw new ErrorHandler(401, "Unauthorized");
    }
    const { companyId } = req.params;

    const [company] = await sql`
    SELECT logo_public_id FROM companies WHERE company_id = ${companyId} AND recruiter_id = ${user?.user_id}`;

    if (!company) {
        throw new ErrorHandler(404, "Company not found or you are not authorized to delete this company");
    }


    await sql`
    DELETE FROM companies WHERE company_id = ${companyId}`;

    res.json({
        message: "Company and all associated jobs deleted successfully"
    })
})


export const createJob = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
        throw new ErrorHandler(401, "Unauthorized");
    }

    if (user?.role !== "recruiter") {
        throw new ErrorHandler(403, "Forbidden :Only recruiters can create job postings");
    }

    const { title, description, salary, location, role, job_type, work_location, openings, company_id } = req.body;

    if (!title || !description || !role || !salary || !location || !openings) {
        throw new ErrorHandler(400, "Please fill all required details");
    }

    const [company] = await sql`SELECT company_id FROM companies WHERE company_id = ${company_id} AND recruiter_id = ${user.user_id}`;

    if (!company) {
        throw new ErrorHandler(404, "Company not found");
    }

    const [newJob] = await sql`
    INSERT INTO jobs (title,description,salary,location,role,job_type,work_location,company_id,posted_by_recruiter_id,openings)
    VALUES (${title},${description},${salary},${location},${role},${job_type},${work_location},${company_id},${user.user_id},${openings}) RETURNING *`;


    res.json({
        message: "Job created successfully",
        job: newJob
    })

})


export const updateJob = TryCatch(async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
        throw new ErrorHandler(401, "Unauthorized")
    }

    const { title, description, salary, location, role, job_type, work_location, openings, is_active } = req.body;

    const [existingJob] = await sql`
        SELECT posted_by_recruiter_id FROM jobs WHERE job_id=${req.params.id}`;

    if (!existingJob) {
        throw new ErrorHandler(404, "Job not found");
    }

    if (existingJob.posted_by_recruiter_id !== user.user_id) {
        throw new ErrorHandler(401, "You are not the owner of this job posting")
    }

    const [updatedJob] = await sql`
        UPDATE jobs SET title = ${title},description = ${description},salary = ${salary},location = ${location},role=${role},job_type = ${job_type},work_location = ${work_location},openings = ${openings},is_active = ${is_active}
        WHERE job_id = ${req.params.id}
        RETURNING *`;

    res.json({
        message: "Job updated successfully",
        job: updatedJob
    })
})


export const getAllCompanies = TryCatch(async (req: AuthenticatedRequest, res) => {
    const companies = await sql`
    SELECT * FROM companies WHERE recruiter_id = ${req.user?.user_id}`;

    res.json({
        companies: companies
    })
})


export const getCompanyDetails = TryCatch(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    if (!id) {
        throw new ErrorHandler(400, "Company id is required");
    }

    const [companyData] = await sql`
    SELECT c.*,COALESCE(
    (
        SELECT json_agg(j.*) FROM jobs j WHERE j.company_id = c.company_id
    ), '[]'::json
    ) AS jobs
    FROM companies c WHERE c.company_id = ${id} GROUP BY c.company_id`


    if (!companyData) {
        throw new ErrorHandler(404, "Company not found");
    }
    res.json(companyData);
});


export const getAllActiveJobs = TryCatch(async (req, res) => {
    const { title, location } = req.query as { title?: string, location?: string };

    let queryString = `SELECT j.job_id,j.title,j.description,j.salary,j.location,j.role,j.job_type,j.work_location,
    j.created_at,c.name AS company_name,c.logo AS company_logo,c.company_id as company_id FROM jobs j
    JOIN companies c ON j.company_id = c.company_id
    WHERE j.is_active = true`;

    const values = [];

    let paramIndex = 1;

    if (title) {
        queryString += ` AND j.title ILIKE $${paramIndex}`;
        values.push(`%${title}%`);
        paramIndex++;
    }
    if (location) {
        queryString += ` AND j.location ILIKE $${paramIndex}`;
        values.push(`%${location}%`);
        paramIndex++;
    }

    queryString += ` ORDER BY j.created_at DESC`;

    const jobs = await sql.query(queryString, values);

    res.json(jobs);
}
)


export const getSingleJob = TryCatch(async(req,res)=>{
    const id = req.params.id;

    if(!id){
        throw new ErrorHandler(400,"Job id is required");
    }

    const[job]= await sql`
    SELECT * FROM jobs WHERE job_id = ${id}`;

    res.json(job);
})

export const getAllApplicationsForJob = TryCatch(async(req:AuthenticatedRequest,res)=>{
    const user = req.user;

    if(!user){
        throw new ErrorHandler(401,"Unauthorized");
    }

    if(user.role !== "recruiter"){
        throw new ErrorHandler(403,"Only recruiters can view applications for a job");
    }

    const {jobId} = req.params;

    if(!jobId){
        throw new ErrorHandler(400,"Job id is required");
    }

    const [job] = await sql`
    SELECT posted_by_recruiter_id FROM jobs WHERE job_id = ${jobId}`;

    if(!job){
        throw new ErrorHandler(404,"Job not found");
    }

    if(job.posted_by_recruiter_id !== user.user_id){
        throw new ErrorHandler(403,"You are not authorized to view applications for this job");
    }

    const applications = await sql`
    SELECT * FROM applications WHERE job_id = ${jobId} ORDER BY subscribed DESC,applied_at DESC`;

    res.json(applications);
})

export const updateApplication = TryCatch(async(req:AuthenticatedRequest,res)=>{
    const user = req.user;

    if(!user){
        throw new ErrorHandler(401,"Unauthorized");
    }

    if(user.role !== "recruiter"){
        throw new ErrorHandler(403,"Only recruiters can update application status");
    }

    const {id} = req.params;

    const [application] = await sql`
    SELECT * FROM applications WHERE application_id = ${id}`;

    if(!application){
        throw new ErrorHandler(404,"Application not found");
    }

    const[job] = await sql`
    SELECT posted_by_recruiter_id,title FROM jobs WHERE job_id = ${application.job_id}`;

    if(!job){
        throw new ErrorHandler(404,"No job with this id");
    }

    if(job.posted_by_recruiter_id !== user.user_id){
        throw new ErrorHandler(403,"You are not authorized to update status for this application");
    }

    const[updatedApplication] = await sql`
    UPDATE applications SET status = ${req.body.status} WHERE application_id =${id} RETURNING *`;

    const message = {
        to : application.applicant_email,
        subject : "Application Update - Job portal",
        html : applicationStatusUpdateTemplate(job.title)
    }

    publishToTopic("send_email",message).catch(error=>{
        console.error("Failed to publish email notification",error);
    });

    res.json({
        message : "Application updated successfully",
        job,
        updateApplication
    });
})