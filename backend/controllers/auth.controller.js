import User from "../models/user.model.js";
import {redis} from "../lib/redis.js";
import jwt from "jsonwebtoken";


const generateTokens = (userId) => {
  const accessToken = jwt.sign({userId}, process.env.ACCESS_TOKEN_SECRET,{
    expiresIn: "30m"
  })
  const refreshToken = jwt.sign({userId}, process.env.REFRESH_TOKEN_SECRET,{
    expiresIn: "1d"
  })
  return {accessToken, refreshToken}
}

const storeRefreshToken = async (userId, refreshToken) =>{
  await redis.set(`refreshToken:${userId}`, refreshToken, "EX", 24 * 60 * 60);
}

const setCookies = (res, accessToken, refreshToken) => {
  res.cookie("access_Token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 60 * 1000 // 30 minutes
  })
  res.cookie("refresh_Token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  })

}



export const signup = async  (req, res) => { 
  const {email,name,password} = req.body;
  try {
      const userExists = await User.findOne({email});

    if(userExists) return res.status(400).json({message: "User already exists"});

    const user = await User.create({
      name,
      email,
      password
    });

    const {accessToken, refreshToken}=generateTokens (user._id);
    await storeRefreshToken(user._id, refreshToken);
    setCookies(res, accessToken, refreshToken);

    res.status(201).json({user:{
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    }, message: "User created successfully"});
  } catch (error) {
    console.log("error in signup controller",error);
    res.status(500).json({message: "Internal server error"});
  }
}

export const login = async(req, res) => {
  try {
    const {email, password} = req.body;
    const user = await User.findOne({email});

    if(user && (await user.comparePassword(password))){

      const {accessToken,refreshToken}=generateTokens(user._id);
      await storeRefreshToken(user._id, refreshToken);
      setCookies(res, accessToken, refreshToken);

      res.json({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,

      })
    }
    else{
      res.status(401).json({message: "Invalid credentials"});
    }
  } catch (error) {
    console.log("error in login controller",error);
    if(error.name === "JsonWebTokenError"){
      return res.status(401).json({message: "Invalid token"});
    }
    if(error.name === "TokenExpiredError"){
      return res.status(401).json({message: "Token expired"});
    } 
    res.status(500).json({message: "Internal server error"});
  }
}

export const logout = async(req, res) => {
  try {
    const refreshToken = req.cookies.refresh_Token;
    if(refreshToken){
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      await redis.del(`refreshToken:${decoded.userId}`);
    }
    res.clearCookie("access_Token");
    res.clearCookie("refresh_Token");
    res.status(200).json({message: "Logged out successfully"});
  } catch (error) {
    console.log("error in logout controller",error);
    res.status(500).json({message: "Internal server error", error: error.message});
  }
}


export const refreshToken = async(req,res) =>{
  try {
    const refreshToken = req.cookies.refresh_Token;
    if(!refreshToken) return res.status(401).json({message:"No refresh token found"});
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const userId = decoded.userId;
    const storedRefreshToken = await redis.get(`refreshToken:${userId}`);
    if(refreshToken !== storedRefreshToken) return res.status(403).json({message:"Invalid refresh token"});
    const accessToken = jwt.sign({userId}, process.env.ACCESS_TOKEN_SECRET,{
      expiresIn: "30m"
    })
    res.cookie("access_Token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 60 * 1000 // 30 minutes
    }) 
    res.status(200).json({message: "Access token refreshed successfully"});
  } catch (error) {
    console.log("error in refresh token controller",error);
    res.status(401).json({message: "Internal server error", error: error.message});
  }
}


export const getProfile = async(req,res) => {
  try {
    
    res.status(200).json(req.user);
  } catch (error) {
    console.log("error in get profile controller",error);
    res.status(500).json({message: "Internal server error", error: error.message});
  }
}