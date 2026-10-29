# School Database Design

## Tables

- **`students`** stores each student's first name, last name and unique email address. `student_id` is the primary key.
- **`courses`** stores a unique course code and course name. `course_id` is the primary key.
- **`enrolments`** records which student takes which course and the student's grade. `enrolment_id` is its primary key; `student_id` and `course_id` are foreign keys to the other tables. Both foreign keys and the grade are required.

The unique constraint on `(student_id, course_id)` prevents the same student from being enrolled on the same course twice. The unique email constraint prevents two student records from sharing an email address.

## Relationships

One student can have many enrolments, while each enrolment belongs to one student. One course can have many enrolments, while each enrolment belongs to one course. Students and courses therefore have a many-to-many relationship: a student can take several courses, and each course can have several students. The `enrolments` join table turns that relationship into two one-to-many relationships and provides a place to store the grade for each student-course pair.

## Index

I added an index on `enrolments.course_id`. It helps the database find the enrolments for a course quickly, which supports queries that list students on one course or count enrolments by course. The unique `(student_id, course_id)` constraint also creates an index useful for student-first lookups.

## SQL or NoSQL?

I would use a relational SQL database for this school system. Students, courses and enrolments have clear relationships, and foreign keys and unique constraints protect those relationships from invalid data. SQL joins make it straightforward to answer questions such as which courses a student takes and how many students are enrolled on each course. A document database could store a student and a list of courses together, but repeated course details would be harder to keep consistent as course information changes.
