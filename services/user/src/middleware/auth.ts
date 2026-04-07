import { NextFunction, Request, Response } from "express"

import jwt, { JwtPayload } from "jsonwebtoken"
import { sql } from "../utils/db.js";
import { TryCatch } from "../utils/TryCatch.js";
import ErrorHandler from "../utils/errorHandler.js";
 

interface User {
    user_id : number,
    name : string,
    email : string,
    password : string,
    phone_number : string,
    role : "jobseeker" | "recruiter",
    bio : string | null,
    resume : string | null,
    resume_public_id : string | null,
    profile_pic : string | null,
    profile_pic_public_id : string | null,
    skills : string[],
    subscription : string | null
 }

 export interface AuthenticatedRequest extends Request{
    user?: User
 }


 export const isAuth = async(req: AuthenticatedRequest,res: Response,next: NextFunction):Promise<void> =>{
    try {
        const authHeader = req.headers.authorization;

        if(!authHeader || !authHeader.startsWith("Bearer ")){
            res.status(401).json({
                message : "Authorization header is missing or invalid"
            })
            return ;
        }

        const token = authHeader.split(" ")[1];

        const decodedPayload = jwt.verify(token,process.env.JWT_SEC as string) as JwtPayload


        if(!decodedPayload ||  !decodedPayload.id){
            res.status(401).json({
                message : "Invalid token"
            })
            return;
        }

        // Ensure this is an auth token, not a reset token
        if(decodedPayload.type === 'reset'){
            res.status(401).json({
                message : "Reset token cannot be used for authentication"
            })
            return;
        }

        const users = (await sql`
        SELECT u.user_id,u.name,u.email,u.password,u.phone_number,u.role,u.bio,u.resume,u.resume_public_id,u.profile_pic,u.profile_pic_public_id,u.subscription,
        ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) as skills FROM users u
        LEFT JOIN user_skills us ON u.user_id = us.user_id
        LEFT JOIN skills s ON us.skill_id = s.skill_id
        WHERE u.user_id = ${decodedPayload.id} GROUP BY u.user_id;`);

        if(users.length === 0){
            res.status(401).json({
                message : "User not found"
            })
            return;
        }

        const user = users[0] as User;

        user.skills = user.skills || [];

        req.user = user;

        next();    
    } catch (error: any) {
        console.log(error);
        
        // Return specific error messages based on token error type
        if(error.name === 'TokenExpiredError'){
            res.status(401).json({
                message : "Token has expired"
            })
        } else if(error.name === 'JsonWebTokenError'){
            res.status(401).json({
                message : "Invalid token signature"
            })
        } else {
            res.status(401).json({
                message : "Unauthorized"
            })
        }
    }
 } 

export const addSkillToUser = TryCatch(async(req:AuthenticatedRequest,res:Response,next:NextFunction)=>{
    const userId = req.user?.user_id;

    const { skillName} = req.body;

    if(!skillName || skillName.trim() === ""){
        res.status(400).json({
            message : "Skill is required"
        })
        return ;
    }

    let wasSkillAdded =false;

    try {

        const users = await sql`
        SELECT user_id FROM users WHERE user_id = ${userId}`;

        if(users.length === 0){
            throw new ErrorHandler(404,"User not found");
        }

        const[skill] = await sql`
        INSERT INTO skills (name) VALUES (${skillName.trim()}) ON 
        CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING skill_id`;
        
        const skillId = skill.skill_id;

        const insetionResult = await sql`
        INSERT INTO user_skills (user_id, skill_id) VALUES (${userId},${skillId}) ON 
        CONFLICT (user_id,skill_id) DO NOTHING RETURNING user_id`;

        if(insetionResult.length > 0){
            wasSkillAdded = true;
        }

        await sql`COMMIT`;
        
    } catch (error) {
        await sql`ROLLBACK`;
        throw error; 
        
    }

    if(!wasSkillAdded){
        return res.status(200).json({
            message : "Skill already exists for user"
        })
    }

    res.status(201).json({
        message : "Skill added successfully"
    })

})


export const deleteSkillFromUser = TryCatch(async(req: AuthenticatedRequest,res: Response,next : NextFunction)=>{
    const user = req.user;

    if(!user){
        throw new ErrorHandler(401,"Unauthorized");
    }

    const { skillName} = req.body;

    if(!skillName || skillName.trim() === ""){
        res.status(400).json({
            message : "Please provide a skill name"
        })
        return ;
    }

    const result = await sql`
    DELETE FROM user_skills WHERE user_id = ${user.user_id} AND 
    skill_id = (SELECT skill_id FROM skills WHERE name = ${skillName.trim()}) RETURNING user_id`;

    if(result.length === 0){
        return res.status(404).json({
            message : "Skill not found for user"
        })
    }

    res.json({
        message : `Skill ${skillName.trim()} was deleted successfully`
    })



})
