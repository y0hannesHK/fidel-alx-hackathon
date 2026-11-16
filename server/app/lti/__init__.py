"""LTI 1.3: learning platforms (Moodle, Canvas) open Fidel lessons.

  keys.py    Fidel's own RSA key pair, and its public part as a key set (JWKS)
  launch.py  the checks on a platform's signed launch message
  pages.py   what the learner sees while signing in, and every problem in words
  ags.py     sends "completed" to the course's gradebook (Assignment and Grade Services)

The routes are in app/api/lti.py. Off unless FIDEL_LTI_ENABLED is true.
"""
