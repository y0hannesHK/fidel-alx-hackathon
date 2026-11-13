from app.captions import Cue, Word, cues_from_words, from_vtt, to_vtt, wrap_two_lines


def words(text: str, start: float = 0.0, step: float = 0.4) -> list[Word]:
    out = []
    for i, w in enumerate(text.split()):
        out.append(Word(start + i * step, start + (i + 1) * step, " " + w))
    return out


def test_cue_ends_at_end_of_sentence():
    cues = cues_from_words(words("Hello there. This is Fidel."))
    assert [c.text for c in cues] == ["Hello there.", "This is Fidel."]
    assert cues[0].start == 0.0 and cues[1].start == 0.8


def test_long_speech_is_split_into_short_cues():
    text = " ".join(["word"] * 60)  # no full stops at all
    cues = cues_from_words(words(text, step=0.2))
    assert len(cues) > 1
    for cue in cues:
        assert len(cue.text.replace("\n", " ")) <= 84
        assert cue.end - cue.start <= 7.0 + 0.2


def test_amharic_full_stop_ends_a_cue():
    cues = cues_from_words(words("ሰላም ነው። እንዴት ነህ?", step=1.0))
    assert [c.text for c in cues] == ["ሰላም ነው።", "እንዴት ነህ?"]


def test_wrap_two_lines_balances_long_captions():
    wrapped = wrap_two_lines("We firmly believe that technical education is the ultimate equalizer")
    first, second = wrapped.split("\n")
    assert abs(len(first) - len(second)) < 15


def test_vtt_round_trip_keeps_timings_and_text():
    cues = [Cue(1.5, 3.25, "Hello\nworld"), Cue(61.0, 62.0, "ሰላም")]
    assert from_vtt(to_vtt(cues, note="a note")) == cues


def test_tiny_cue_is_joined_to_the_previous_one():
    # "opportunities." alone would show for only 0.4 s.
    many = " ".join(["word"] * 14)  # make the first cue end by length, not by a full stop
    cues = cues_from_words(words(many, step=0.3) + [Word(4.3, 4.7, " opportunities.")])
    assert cues[-1].text.replace("\n", " ").endswith("opportunities.")
    assert all(c.end - c.start >= 1.2 for c in cues)
