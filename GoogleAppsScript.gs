/**
 * Moments Gallery - Google Apps Script Backend
 * লাইভ ফটো আপলোড + গুগল ড্রাইভ সিঙ্ক + রিয়েল-টাইম লাইক (Likes) সিস্টেম
 * 
 * সেটিংস নির্দেশাবলী (Setup Instructions):
 * 1. script.google.com এ গিয়ে আপনার বিদ্যমান স্ক্রিপ্ট প্রোজেক্ট ওপেন করুন।
 * 2. নিচের সম্পূর্ণ কোডটি পেস্ট করুন।
 * 3. Deploy > Manage Deployments > Edit (বা New Deployment) ক্লিক করুন।
 * 4. Version: "New Version" দিন, Who has access: "Anyone" সিলেক্ট করে Deploy করুন।
 */

// আপনার ফোল্ডার আইডি (প্রয়োজনে পরিবর্তন করতে পারেন)
const FOLDER_ID = ""; // ফাঁকা রাখলে স্ক্রিপ্ট যে ফোল্ডারে আছে স্বয়ংক্রিয়ভাবে সেটি অথবা রুট ফোল্ডার ব্যবহার করবে

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : null;
    
    // ১. শুধুমাত্র লাইক লিস্ট দেখা
    if (action === "get_likes") {
      const likes = getStoredLikes();
      return jsonResponse({ success: true, likes: likes });
    }
    
    // ২. GET রিকোয়েস্টে লাইক আপডেট করা (Cross-origin CORS Safe)
    if (action === "like") {
      const photoId = e.parameter.id;
      const delta = parseInt(e.parameter.delta || "1", 10);
      if (!photoId) {
        return jsonResponse({ success: false, error: "Photo ID required" });
      }
      const newCount = updateLikeCount(photoId, delta);
      return jsonResponse({ success: true, id: photoId, likes: newCount });
    }

    // ৩. ডিফল্ট: সমস্ত ফটো এবং তাদের বর্তমান লাইক কাউন্ট লোড করা
    let folder;
    if (FOLDER_ID && FOLDER_ID.trim() !== "") {
      folder = DriveApp.getFolderById(FOLDER_ID);
    } else {
      // স্বয়ংক্রিয়ভাবে স্ক্রিপ্টের প্যারেন্ট ফোল্ডার বা রুট ডিটেক্ট করা
      try {
        const fileId = ScriptApp.getScriptId();
        const scriptFile = DriveApp.getFileById(fileId);
        const parents = scriptFile.getParents();
        folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
      } catch (err) {
        folder = DriveApp.getRootFolder();
      }
    }

    const files = folder.getFiles();
    const photos = [];
    const storedLikes = getStoredLikes();

    while (files.hasNext()) {
      const file = files.next();
      const mime = file.getMimeType();
      if (mime.indexOf("image/") === 0) {
        const id = file.getId();
        const date = file.getDateCreated();
        const timeStr = Utilities.formatDate(date, Session.getScriptTimeZone() || "GMT+6", "HH:mm");
        
        photos.push({
          id: id,
          name: file.getName(),
          timestamp: date.getTime(),
          date: timeStr,
          likes: storedLikes[id] || 0,
          thumbnail: "https://lh3.googleusercontent.com/d/" + id + "=s400",
          fullUrl: "https://lh3.googleusercontent.com/d/" + id + "=s1600"
        });
      }
    }

    // নতুন ছবিগুলো সবার আগে সাজানো (Newest First)
    photos.sort(function(a, b) {
      return b.timestamp - a.timestamp;
    });

    return jsonResponse({ success: true, photos: photos, allLikes: storedLikes });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    // ১. লাইক বৃদ্ধি বা হ্রাস
    if (action === "like") {
      const photoId = postData.id;
      const delta = parseInt(postData.delta || "1", 10);
      const newCount = updateLikeCount(photoId, delta);
      return jsonResponse({ success: true, id: photoId, likes: newCount });
    }

    // ২. ফটো আপলোড প্রসেসিং
    if (action === "upload") {
      const fileName = postData.name || ("Photo_" + new Date().getTime() + ".webp");
      const base64Data = postData.file.split(",")[1] || postData.file;
      const decodedBytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedBytes, "image/webp", fileName);

      let folder;
      if (FOLDER_ID && FOLDER_ID.trim() !== "") {
        folder = DriveApp.getFolderById(FOLDER_ID);
      } else {
        try {
          const fileId = ScriptApp.getScriptId();
          const scriptFile = DriveApp.getFileById(fileId);
          const parents = scriptFile.getParents();
          folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
        } catch (err) {
          folder = DriveApp.getRootFolder();
        }
      }

      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return jsonResponse({
        success: true,
        id: file.getId(),
        name: file.getName(),
        viewUrl: "https://lh3.googleusercontent.com/d/" + file.getId() + "=s1600",
        likes: 0
      });
    }

    return jsonResponse({ success: false, error: "Invalid action" });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// 💾 লাইক ডেটা পারসিস্টেন্টলি সংরক্ষণ করার হেল্পার ফাংশন
function getStoredLikes() {
  const prop = PropertiesService.getScriptProperties().getProperty("MOMENTS_LIKES_MAP");
  if (!prop) return {};
  try {
    return JSON.parse(prop);
  } catch (e) {
    return {};
  }
}

function updateLikeCount(photoId, delta) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const likesMap = getStoredLikes();
    const current = likesMap[photoId] || 0;
    const updated = Math.max(0, current + delta);
    likesMap[photoId] = updated;
    PropertiesService.getScriptProperties().setProperty("MOMENTS_LIKES_MAP", JSON.stringify(likesMap));
    return updated;
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
