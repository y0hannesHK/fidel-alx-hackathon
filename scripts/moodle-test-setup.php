<?php
// Run inside the test Moodle (scripts/moodle-test-setup.sh): a course for the
// Fidel LTI test, a student enrolled in it. Safe to run again.
define('CLI_SCRIPT', true);
require('/opt/bitnami/moodle/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->libdir . '/enrollib.php');

$course = $DB->get_record('course', ['shortname' => 'fidel-lti']);
if (!$course) {
    $course = create_course((object)[
        'fullname' => 'Fidel LTI test course', 'shortname' => 'fidel-lti', 'category' => 1,
        'summary' => 'Course for testing Fidel lessons through LTI 1.3.',
    ]);
}
$student = $DB->get_record('user', ['username' => 'student1']);
if (!$student) {
    $id = user_create_user((object)[
        'username' => 'student1', 'password' => 'Student-1234!', 'firstname' => 'Selam', 'lastname' => 'Test',
        'email' => 'student1@example.org', 'auth' => 'manual', 'confirmed' => 1,
        'mnethostid' => $CFG->mnet_localhost_id, 'lang' => 'en',
    ]);
    $student = $DB->get_record('user', ['id' => $id]);
}
$role = $DB->get_record('role', ['shortname' => 'student']);
enrol_try_internal_enrol($course->id, $student->id, $role->id);
echo "course id {$course->id}, student id {$student->id}\n";
