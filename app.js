"use strict";

require("dotenv").config();
const express = require("express");
const https = require("https");
const mongoose = require("mongoose");
const _ = require("lodash");
const app = express();
const ejs = require("ejs");
const fs = require("fs");
const bodyParser = require("body-parser");
const date = new Date().getFullYear();
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const fileUpload = require("express-fileupload");
const MemoryStore = require("memorystore")(session);

//the passport code must be under these three
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    resave: false,
    secret: process.env.SECRET,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(fileUpload());
mongoose.connect("mongodb://localhost:27017/ashmerlyndbtesting", {
  useNewUrlParser: true,
});
//some REAL passport code in the event of a bug
//mongoose.set("useCreateIndex",true)
const PersonSchema = new mongoose.Schema({
  surname: String,
  firstname: String,
  othernames: String,
  sex: String,
  role: String,
  admin: Boolean,
  dateofbirth: Date,
  email: String,
  contactdetails: String,
  studentyear: Number,
  studentarm: String,
  schoolfees: String,
  recordcreated: Date,
  status: String,
  username: String,
});

const ProfilePictureSchema = new mongoose.Schema({
  _id: String,
  profilepicture: String,
});
//some REAL passport code is under here
PersonSchema.plugin(passportLocalMongoose);
const Person = new mongoose.model("Person", PersonSchema);
const Picture = new mongoose.model("Picture", ProfilePictureSchema);
//some more of that REAL passport code is also under here
passport.use(Person.createStrategy());
passport.serializeUser(Person.serializeUser());
passport.deserializeUser(Person.deserializeUser());
function isLoggedIn(request, response, next) {
  if (request.isAuthenticated()) {
    return next();
  }
  const errormessage = "Expired login credentials, Reload page to log in again";
  response.render("blank", { errormessage: errormessage });
}
function isLoggedInMain(request, response, next) {
  if (request.isAuthenticated()) {
    console.log(request.user);
    return next();
  }
  response.redirect("/");
}
function useridgenerator(postparams) {
  const username = `AMIS/SEC/${
    2000 + Number(postparams.username.slice(0, postparams.username.length - 6))
  }/${postparams.username.slice(
    postparams.username.length - 6,
    postparams.username.length
  )}`;
  return String(username);
}

//CODE FOR THE MAIN APP
app.get("/", function (request, response) {
  response.redirect("/login");
});

app.get("/login", function (request, response) {
  response.render("login", { date: date });
});

//CENTRAL BRANCH CODE THAT LEADS TO THE VARIOUS PARTS
app.post("/login", function (request, response) {
  const username = useridgenerator(request.body);

  request.body.username = username;

  const user = new Person({
    username: username,
    password: request.body.password,
  });
  request.login(user, function (error) {
    if (error) {
      return response.render("partials/errormessage", {
        errormessage: error,
      });
    } else {
      passport.authenticate("local", {
        failureRedirect: "/login",
        failureMessage: true,
        failWithError: true,
      })(request, response, function () {
        Picture.findOne({ _id: username }, function (err, foundPicture) {
          const realimage = Buffer.from(foundPicture.profilepicture, "base64");
          fs.writeFileSync(`public/images/${request.user._id}.jpg`, realimage);
        });
        if (request.user.role === "Student") {
          response.redirect("/login/student");
        } else if (request.user.role === "Teacher" && request.user.admin) {
          response.redirect("/login/admin");
        } else {
          response.redirect("/login/staff");
        }
      });
    }
  });
});

//CODE FOR THE HOMEPAGE OF THE WEB APP
app.get("/login/student", isLoggedInMain, function (request, response) {
  if (request.user.role === "Student") {
    response.render("student/studentpage", { date: date, user: request.user });
  } else {
    const errormessage = "Sorry! You do not have permission to view this page";
    response.render("partials/errormessage", {
      errormessage: errormessage,
    });
  }
});
app.get("/login/admin", isLoggedInMain, function (request, response) {
  if (request.user.role === "Teacher" && request.user.admin) {
    response.render("admin/adminpage", { date: date, user: request.user });
  } else {
    const errormessage = "Sorry! This page is not under your permitted domain";
    response.render("partials/errormessage", {
      errormessage: errormessage,
    });
  }
});

app.get("/login/staff", isLoggedInMain, function (request, response) {
  if (request.user.role === "Teacher" && !request.user.admin) {
    response.render("staff/staffpage", { date: date, user: request.user });
  } else {
    const errormessage =
      "Sorry! Permissions have not been granted for this page";
    response.render("partials/errormessage", {
      errormessage: errormessage,
    });
  }
});

//CODE FOR THE BIODATA PAGE OF THE WEB APP
app.get("/login/:role/biodata", isLoggedIn, function (request, response) {
  const role = request.params.role;
  response.redirect(`/login/${role}`);
});

//code to get the biodata page into a div
app.get("/biodata", isLoggedIn, function (request, response) {
  response.render("partials/biodata", { user: request.user });
});

//STUDENT RELATED CODE FOR RESULT
app.get("/showresult", isLoggedIn, function (request, response) {
  response.render("partials/resultpartials/showresult");
});
app.get("/showhonorroll", isLoggedIn, function (request, response) {
  response.render("partials/resultpartials/showhonorroll");
});
app.get("/showmidterm", isLoggedIn, function (request, response) {
  response.render("partials/resultpartials/showmidterm");
});
//TEACHER RELATED CODE FOR COURSES
app.get("/courselist", isLoggedIn, function (request, response) {
  response.render("partials/staffcourses/courselist");
});
app.get("/courserecord", isLoggedIn, function (request, response) {
  response.render("partials/staffcourses/courserecord");
});
app.get("/formteacherview", isLoggedIn, function (request, response) {
  response.render("partials/staffcourses/formteacherview");
});
app.get("/formteacheredit", isLoggedIn, function (request, response) {
  response.render("partials/staffcourses/formteacheredit");
});
//ADMIN RELATED CODE FOR STUFF
app.get("/paidstudents", isLoggedIn, function (request, response) {
  response.render("partials/adminpartials/paidstudents");
});
app.get("/owingstudents", isLoggedIn, function (request, response) {
  response.render("partials/adminpartials/owingstudents");
});
app.get("/listofclasses", isLoggedIn, function (request, response) {
  response.render("partials/adminpartials/listofclasses");
});
app.get("/listofteachers", isLoggedIn, function (request, response) {
  Person.find(
    { role: "Teacher", admin: false, status: "active" },
    function (err, foundTeachers) {
      console.log("teachers found", foundTeachers);
      response.render("partials/adminpartials/listofteachers", {
        teachers: foundTeachers,
      });
    }
  );
});
app.get(
  "/login/admin/staff/:teacherid",
  isLoggedIn,
  function (request, response) {
    const id = request.params.teacherid;
    Person.find({ _id: id, admin: false }, function (err, foundTeacher) {
      console.log("teachers found", foundTeacher);
      response.render("partials/adminpartials/singularuser", {
        id: id,
        date: date,
        user: request.user,
        teacher: foundTeacher[0],
      });
    });
  }
);
app.get("/teachersummary", isLoggedIn, function (request, response) {
  response.render("partials/adminpartials/teachersummary");
});
app.get("/adminchanges", isLoggedIn, function (request, response) {
  response.render("partials/adminpartials/adminchanges");
});
app.get("/resultanalysis", isLoggedIn, function (request, response) {
  response.render("partials/adminpartials/resultanalysis");
});
app.get("/createuser", isLoggedIn, function (request, response) {
  response.render("partials/adminpartials/createuser", {
    errormessage: "",
  });
});
app.get("/changepassword", isLoggedIn, function (request, response) {
  response.render("partials/adminpartials/changepassword");
});
app.post("/createuser", isLoggedIn, function (request, response) {
  if (!request.files || Object.keys(request.files).length === 0) {
    return response.status(400).send("No files were uploaded.");
  }
  if (request.files.profilepicture.size > 80000) {
    const errormessage = "Your file is too large, it must be less than 70kb";
    return response.render("partials/errormessage", {
      errormessage: errormessage,
    });
  }
  if (request.files.profilepicture.mimetype.slice(0, 5) !== "image") {
    const errormessage = "Attach an image file with extensions .jpg or .png";
    return response.render("partials/errormessage", {
      errormessage: errormessage,
    });
  }
  const userprofilepicture = request.files.profilepicture.data;
  const picinbase64 = userprofilepicture.toString("base64");
  const bufferedprofilepic = Buffer.from(picinbase64, "base64");
  const username = `AMIS/SEC/${date}/${request.body.registration}`;
  const surname = _.trim(_.upperFirst(_.lowerCase(request.body.surname)));
  const firstname = _.trim(_.upperFirst(_.lowerCase(request.body.firstname)));
  const othernames = _.trim(_.upperFirst(_.lowerCase(request.body.othernames)));
  Person.register(
    {
      surname: surname,
      firstname: firstname,
      othernames: othernames,
      sex: request.body.sex,
      role: request.body.role,
      admin: request.body.admin,
      dateofbirth: request.body.date,
      email: request.body.email,
      contactdetails: request.body.phone,
      studentyear: request.body.year,
      studentarm: request.body.arm,
      schoolfees: request.body.fees,
      recordcreated: new Date().toLocaleDateString(),
      status: "active",
      username: username,
    },
    "2022",
    function (error, user) {
      if (error) {
        return response.render("partials/errormessage", {
          errormessage: error,
        });
      } else {
        const newprofilepic = new Picture({
          _id: username,
          profilepicture: picinbase64,
        });
        newprofilepic.save(function (err, result) {
          if (err) {
            return response.render("partials/errormessage", {
              errormessage: err,
            });
          } else {
            return response.redirect("/login/admin");
          }
        });
      }
    }
  );
});
//SETTINGS RELATED CODE
app.get("/contactadmin", isLoggedIn, function (request, response) {
  response.render("partials/settingspartials/contactadmin");
});
app.get("/contactuser", isLoggedIn, function (request, response) {
  response.render("partials/settingspartials/contactuser");
});
app.get("/settinghomepage", isLoggedIn, function (request, response) {
  response.render("partials/settingspartials/settinghomepage");
});
//FINANCE RELATED CODE
//code to get payment page into a div
app.get("/payment", isLoggedIn, function (request, response) {
  response.render("partials/financepartials/payment");
});
app.get("/cardpay", isLoggedIn, function (request, response) {
  response.render("partials/financepartials/cardpay");
});
app.get("/pinpay", isLoggedIn, function (request, response) {
  response.render("partials/financepartials/pinpay");
});
app.get("/showreceipt", isLoggedIn, function (request, response) {
  response.render("partials/financepartials/showreceipt");
});
app.get("/accountstatement", isLoggedIn, function (request, response) {
  response.render("partials/financepartials/accountstatement");
});

//CODE FOR LOGGING OUT OF THE PORTAL
app.get("/user/logout", isLoggedInMain, function (request, response) {
  fs.unlink(`public/images/${request.user._id}.jpg`, function (err) {
    if (err) {
      console.log(err);
    } else {
      console.log("File deleted!");
    }
  });
  request.logOut();
  response.redirect("/");
});
app.use((_, res) => {
  const err = "The page you are looking for does not exist";
  return res.render("partials/errormessage", {
    errormessage: err,
  });
});
app.listen(process.env.PORT || 3000, function () {
  console.log("Server started on port 3000");
});
//TODO 1 Write a functionality to automatically print the transcript of the studenst

//TODO 2 DESIGN HOW THE RESULT PRINTOUT WOULD LOOK LIKE IF THE ADMIN SHOULD DECIDE TO PRINT IT AND IT MUST BE IN THE ASH MERLYN FORMAT
//TODO 3 FUNCTIONALITY TO IIMMEDIATELY DISPLAY ENTERED SCORE ON BEHALF OF TEACHER BESIDE IT AFTER SENDING SCORE TO THE DATABASE SERVER
//TODO 4 Add a feedback functionality that tells you the reason why your webpage is refusing to load
//TODO 5 TEACHERS SHOULD BE ABLE TO CHANGE THE PERMISSIONS OF THEIR STUDENTS IN SENIOR SCHOOL AND DECIDE WHETHER THEY WOULD DO SO AND SO COURSE
//TODO 6 GO AND LEARN HOW TO USE MAILCHIMP FOR MASS EMAIL DISTRIBUTION  AND CHECK WHETHER YOU CAN DO THE SAME WITIH TRELLO
//TODO1 ADD FORM VALIDATORS WITH THE CAPACITY TO DISPLAY ERROR MESSAGES AS THE VERY LAST THING.... i BOOKMARKED A PAGE CALLED YAWWHHH THAT TELLS YOU HOW TO DO IT
//TODO2 ADD A FUNCTIONALITY FOR THE FOROGT PASSWORD SIDE OF THE APP
//THE REAL PASSPORT CODE SUMMARY
//I have discovered that when creating a record
//1. On the username, it must exist as a string in what you are typing in the record except you explicitly stated in the schema that perhaps you would want the username to be a number or  a booolean or something else
//2. if you do not create an id, passport would automatically create one for you
//3 the salt and the hash are automatically generated and have nothing to do with you
//4 you could create any number of fields you want alongside the important ones
