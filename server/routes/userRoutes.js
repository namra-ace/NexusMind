import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = express.Router();

router.post('/register',async (req,res)=>{
    try{
        const {email , password} = req.body;
        if(!email || !password){
            return res.status(400).json({message : 'Please enter all the fields'})
        }
        const userExists = await User.findOne({email : email})
        if(userExists){
            res.status(400).json({message : 'User already exists'})
        }

        const user = await User.create({
            email,
            password,
        })

        if(user){
            const token = jwt.sign({id : user._id},process.env.JWT_SECRET,{expiresIn:'30d'});

            res.status(201).json({
                _id : user._id,
                email : user.email,
                token : token
            })
        }else{
            res.status(400).json({message : "Invalid user data"})
        }
    }
    catch(error){
        res.status(500).json({message : 'Server error', error : error.message})
    }
});

router.post('/login', async (req,res)=>{
    try{
        const {email ,password} = req.body;
        const user = await User.findOne({email})

        if(user && (await bcrypt.compare(password,user.password))){
            const token = jwt.sign({id : user._id},process.env.JWT_SECRET,{expiresIn: '30d'})

            res.json({
                _id : user._id,
                email: user.email,
                token :token
            })
        }
        else{
            res.status(401).json({message:'Invalid email or password'})
        }
    }
    catch(error){
        res.status(500).json({message : 'Server error',error: error.message});
    }
});

export default router;