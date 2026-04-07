import express from 'express'
import { addSkillToUser, deleteSkillFromUser, isAuth } from '../middleware/auth.js';
import { getUserProfile, myProfile, updateProfilePic, updateResume, updateUserProfile } from '../controllers/user.js';
import uploadFile from '../middleware/multer.js';

const router=express.Router();

router.get('/me',isAuth,myProfile)
router.get('/:user_id',isAuth,getUserProfile)
router.put('/update/profile',isAuth,updateUserProfile)
router.put('/update/pic',isAuth,uploadFile,updateProfilePic)
router.put('/update/resume',isAuth,uploadFile,updateResume)
router.post('/skill/add',isAuth,addSkillToUser)
router.delete('/skill/delete',isAuth,deleteSkillFromUser)

export default router