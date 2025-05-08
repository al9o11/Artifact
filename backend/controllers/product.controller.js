import Product from "../models/product.model.js";
import {redis} from "../lib/redis.js";
import cloudinary from "../lib/cloudinary.js";

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export const getFeaturedProducts = async (req, res) => {
  try {
    let featuredProducts = await redis.get("featured_products");
    if(featuredProducts){
      return res.status(200).json(JSON.parse(featuredProducts));
    }
    featuredProducts = await Product.find({ isFeatured: true }).lean();
    if(!featuredProducts){
      return res.status(404).json({ message: "No Products currently featured"});
    }
    await redis.set("featured_products", JSON.stringify(featuredProducts), "EX", 7 * 60 * 60 * 24); 
    res.status(200).json(featuredProducts);  
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ message: "Internal server error",error: error.message });
  } 
}

export const createProduct = async (req,res) =>{
  try {
    const {name, description, price, image, category} = req.body;

    let cloudinaryResponse = null;
    if(image){
      cloudinaryResponse = await cloudinary.uploader.upload(image, { folder: "products" })
    }
    const product = await Product.create({
      name,
      description,
      price,
      image: cloudinaryResponse ?.secure_url ? cloudinaryResponse.secure_url : "",
      category
    })
    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

export const deleteProduct = async (req,res) => {
  try {
    const product = await Product.findById(req.params.id);
    if(!product){
      return res.status(404).json({ message: "Product not found" });
    }
    if(product.image){
      const publicId = product.image.split("/").pop().split(".")[0];
      try {
        await cloudinary.uploader.destroy(`products/${publicId}`);
        console.log("Image deleted from Cloudinary");
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error.message);
        res.status(500).json({ message: "Error deleting image from Cloudinary" });
      }
    }
    await Product.findByIdAndDelete(req.params.id);

  } catch (error) {
    
  }
}

export const getRecommendedProducts = async (req, res) => {
  try {
    const recommendedProducts = await Product.aggregate([
      
      {
        $sample : {size: 3}
      },
      {
        $project:{
          _id: 1,
          name: 1,
          description: 1,
          price: 1,
          image: 1, 
        }
      }
    ]);
    if(!recommendedProducts){
      return res.status(404).json({ message: "No recommended products found" });
    }
    res.status(200).json(recommendedProducts);
  } catch (error) {
    console.error("Error fetching recommended products:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

export const getProductsByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    const products = await Product.find({category});
    if (!products || products.length === 0) {
      return res.status(404).json({ message: "No products found in this category" });
    }
    res.status(200).json({products});
  } catch (error) {
    console.error("Error fetching products by category:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

export const toggleFeaturedProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    product.isFeatured = !product.isFeatured;
    const updatedProduct = await product.save();
    await updateFeaturedProductsCache();
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Error toggling featured product:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

async function updateFeaturedProductsCache() {
  try {
    const featuredProducts = await Product.find({ isFeatured: true }).lean();
    redis.set("featured_products", JSON.stringify(featuredProducts), "EX", 7 * 60 * 60 * 24);  
  } catch (error) {
    console.error("Error updating featured products cache:", error.message);  
  }
}