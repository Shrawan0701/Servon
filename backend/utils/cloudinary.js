const cloudinary = require("cloudinary").v2; 
 
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET, 
}); 
 
const uploadImage = async (fileBuffer, folder = "servon") => { 
  return new Promise((resolve, reject) => { 
const uploadStream = cloudinary.uploader.upload_stream( 
{ folder, resource_type: "image" }, 
(error, result) => { 
if (error) reject(error); 
else resolve(result.secure_url); 
} 
); 
uploadStream.end(fileBuffer); 
}); 
}; 
const deleteImage = async (publicId) => { 
return cloudinary.uploader.destroy(publicId); 
}; 
module.exports = { uploadImage, deleteImage };