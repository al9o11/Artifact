import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectedRoute =async (req, res, next) => {
  try {
    const accessToken = req.cookies.access_Token;
    if (!accessToken) {
      return res.status(401).json({ message: "Unauthorized - Token not found" });
    }
    try {
      const decoded = jwt .verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) {
        return res.status(401).json({ message: "Unauthorized - User not found" });
      }
      req.user = user;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Unauthorized - Token expired" });
      }
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
      throw error;
    }
    
  } catch (error) {
    console.error("Error in protectedRoute middleware:", error);
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
}

export const adminRoute = async (req, res, next) => {
  if(req.user && req.user.role === "admin"){
    next();
  }
  else{
    return res.status(403).json({ message: "Access Denied" });
  }
}