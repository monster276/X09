const Classroom = require("../models/classroomModel");
const enrollCourse = require("../models/enrollCourse");
const Student = require("../models/studentModel");
const StudentAttendances = require("../models/attendancesModel");
const asyncHandler = require("express-async-handler");
const { validationResult } = require("express-validator");
// const mongoose = require("mongoose");
const sendEmailForClassroom = require("../utils/sendEmailForClassroom");

// @desc    Fetch all classrooms
// @route   GET /api/classrooms
// @access  Private/Teacher
const getClassrooms = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.pageNumber) || 1;

  const keyword = req.query.keyword
    ? {
        $or: [
          {
            id: {
              $regex: req.query.keyword,
              $options: "x",
            },
          },
          {
            name: {
              $regex: req.query.keyword,
              $options: "x",
            },
          },
        ],
      }
    : {};

  const count = await Classroom.countDocuments({ ...keyword });

  const classrooms = await Classroom.find({ ...keyword })
    .sort({ createAt: -1 })
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .populate("user", "fullName")
    .populate("location", "name")
    .populate("course", "name")
    .populate({ path: "students", populate: { path: "fullName" } });

  res.json({ classrooms, page, pages: Math.ceil(count / pageSize) });
});

// @desc    Fetch a single classroom
// @route   GET /api/classrooms/:id
// @access  Private/Teacher
const getClassroomById = asyncHandler(async (req, res) => {
  const classroom = await Classroom.findById(req.params.id)
    .populate("user", "fullName")
    .populate("location", "name")
    .populate("course", "name")
    .populate({ path: "students", populate: { path: "fullName" } });

  if (classroom) {
    res.json(classroom);
  } else {
    res.status(404);
    throw new Error("Classroom not found");
  }
});

// @desc    Create a single classroom
// @route   POST /api/classrooms
// @access  Private/Teacher
const createClassroom = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    id,
    user,
    location,
    course,
    name,
    startTime,
    endTime,
    numberOfLessons,
    classTime,
    schedule,
    students,
  } = req.body;

  try {
    const newClassroom = new Classroom({
      id,
      user,
      location,
      course,
      name,
      startTime,
      endTime,
      numberOfLessons,
      classTime,
      schedule,
      students,
    });

    const classroom = await newClassroom.save();

    classroom.students.map(async (enrollId) => {
      const studentEnroll = await enrollCourse.findById(enrollId);

      // Change enroll course status 1 -> 2
      studentEnroll.status = 2;

      await studentEnroll.save();

      const checkStudentAvailable = await Student.find().select("email");
      // Create new students
      const newStudent = await new Student({
        fullName: studentEnroll.fullName,
        email: studentEnroll.email,
        phoneNumber: studentEnroll.phoneNumber,
      });

      const student = await newStudent.save();

      // Create Student attendances
      const newStudentAttendances = await new StudentAttendances({
        student: student._id,
        classroom: classroom._id,
      });

      await newStudentAttendances.save();

      // Send Email to Student
      sendEmailForClassroom(
        student.email,
        classroom
      );
    });

    res.json(classroom);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @desc    Delete a single classroom
// @route   DELETE /api/classroom/:id
// @access  Private/Teacher
const deleteClassroom = asyncHandler(async (req, res) => {
  const classroom = await Classroom.findById(req.params.id);

  if (classroom) {
    await Classroom.findByIdAndDelete(req.params.id);
    res.json({ message: "Classroom removed" });
  } else {
    res.status(404);
    throw new Error("Classroom not found");
  }
});

// @desc    Update a single classroom
// @route   PUT /api/classrooms/:id
// @access  Private/Teacher
const updateClassroom = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    id,
    name,
    course,
    startTime,
    endTime,
    numberOfLessons,
    classTime,
    students,
  } = req.body;

  const classroom = await Classroom.findById(req.params.id)
    .populate("user", "fullName")
    .populate("location", "name")
    .populate("course", "name")
    .populate({
      path: "students",
      populate: { path: "fullName" },
    });

  if (classroom) {
    classroom.id = id;
    classroom.course = course;
    classroom.name = name;
    classroom.startTime = startTime;
    classroom.endTime = endTime;
    classroom.numberOfLessons = numberOfLessons;
    classroom.classTime = classTime;
    classroom.students = students;

    classroom.students.map(async (enrollId) => {
      const studentEnroll = await enrollCourse.findById(enrollId);

      // Change enroll course status 1 -> 2
      studentEnroll.status = 2;

      await studentEnroll.save();

      // Create new students
      const newStudent = await new Student({
        fullName: studentEnroll.fullName,
        email: studentEnroll.email,
        phoneNumber: studentEnroll.phoneNumber,
      });

      const student = await newStudent.save();

      // Create Student attendances
      const newStudentAttendances = await new StudentAttendances({
        student: student._id,
        classroom: classroom._id,
      });

      await newStudentAttendances.save();
    });

    // const studentEnroll = await enrollCourse.findById(classroom.students);
    // console.log(classroom.students[1]);
    // studentEnroll.status = 2;
    // await studentEnroll.save();

    const updateClassroom = await classroom.save();

    res.json(updateClassroom);
  } else {
    res.status(404);
    throw new Error("Classroom not found");
  }
});

module.exports = {
  getClassrooms,
  getClassroomById,
  createClassroom,
  deleteClassroom,
  updateClassroom,
};
