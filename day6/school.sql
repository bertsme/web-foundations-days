PRAGMA foreign_keys = ON;

CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  course_id INTEGER PRIMARY KEY,
  course_code TEXT NOT NULL UNIQUE,
  course_name TEXT NOT NULL
);

CREATE TABLE enrolments (
  enrolment_id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
  FOREIGN KEY (student_id) REFERENCES students(student_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  UNIQUE (student_id, course_id)
);

-- Speeds up queries that find all students enrolled on a course.
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

INSERT INTO students (student_id, first_name, last_name, email) VALUES
  (1, 'Amina', 'Otieno', 'amina.otieno@example.com'),
  (2, 'Brian', 'Mwangi', 'brian.mwangi@example.com'),
  (3, 'Chao', 'Chen', 'chao.chen@example.com'),
  (4, 'Dalia', 'Hassan', 'dalia.hassan@example.com');

INSERT INTO courses (course_id, course_code, course_name) VALUES
  (1, 'WEB101', 'Web Development'),
  (2, 'DB201', 'Database Fundamentals'),
  (3, 'SYS301', 'Systems Design');

INSERT INTO enrolments (enrolment_id, student_id, course_id, grade) VALUES
  (1, 1, 1, 'B'),
  (2, 1, 2, 'A'),
  (3, 2, 1, 'C'),
  (4, 2, 3, 'B'),
  (5, 3, 2, 'B'),
  (6, 3, 3, 'A');

-- 1. List all courses and grades for one student, selected by full name.
SELECT c.course_code, c.course_name, e.grade
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.first_name || ' ' || s.last_name = 'Amina Otieno'
ORDER BY c.course_name;

-- 2. List all students enrolled on one course.
SELECT s.first_name, s.last_name, s.email, e.grade
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.course_code = 'WEB101'
ORDER BY s.last_name, s.first_name;

-- 3. Count students per course, including courses with no enrolments.
SELECT c.course_code, c.course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_code, c.course_name
ORDER BY c.course_code;

-- 4. Find students who are not enrolled on any course.
SELECT s.student_id, s.first_name, s.last_name, s.email
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL
ORDER BY s.last_name, s.first_name;

-- 5. Update one enrolment's grade.
UPDATE enrolments
SET grade = 'A'
WHERE enrolment_id = 3;
