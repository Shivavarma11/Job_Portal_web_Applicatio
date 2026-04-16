import express from "express";
import { isAuth } from "../middleware/auth.js";
import uploadFile from "../middleware/multer.js";
import { createCompany, createJob, deleteCompany, getAllActiveJobs, getAllApplicationsForJob, getAllCompanies, getCompanyDetails, getSingleJob, updateApplication, updateJob } from "../controllers/job.js";


const router = express.Router();

router.post('/company/create',isAuth,uploadFile,createCompany)
router.delete('/company/:companyId',isAuth,deleteCompany)
router.post('/new',isAuth,createJob)
router.put('/:id',isAuth,updateJob)
router.get('/company/all',isAuth,getAllCompanies)
router.get('/company/:id',isAuth,getCompanyDetails)
router.get('/all',isAuth,getAllActiveJobs)
router.get('/:id',isAuth,getSingleJob)
router.get('/applications/:jobId',isAuth,getAllApplicationsForJob)
router.put("/application/update/:id",isAuth,updateApplication)

export default router;