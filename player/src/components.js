// Entry point of fidel-components.js (and fidel-components.css): the
// component library, Packages A–E and the form fields (43 tags).
//
// It is a separate file so a page with only a player does not download it
// (it is about a third of Fidel's size). fidel.js loads it by itself the first
// time a component tag such as <fidel-quiz> appears on the page, so hosts
// still need only the one <script> tag. A page may also load it directly:
//   <script src=".../embed/v1/fidel-components.js" defer></script>
import './components/a/register.js'; // Package A: reading and understanding
import './components/b/register.js'; // Package B: data, offline, dates and language
import './components/c/register.js'; // Package C: Deaf learners, motor access, navigation, help
import './components/d/register.js'; // Package D: Amharic keyboard, sign answers, live events, caption reports
import './components/forms/register.js'; // Forms: text fields, form, choices, select, file, date
import './components/e/register.js'; // Package E: lesson formats, questions, notes, quiz, callouts, tables
