import express from "express";
import { isAuth } from "../middleware/auth.js";
import uploadFile from "../middleware/multer.js";
import { createCompany, createJob, deleteCompany, updateJob } from "../controllers/job.js";


const router = express.Router();

router.post('/company/create',isAuth,uploadFile,createCompany)
router.delete('/company/:companyId',isAuth,deleteCompany)
router.post('/new',isAuth,createJob)
router.put('/update/:id',isAuth,updateJob)

export default router;