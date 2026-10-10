# Code mode

Front and Back each have a **Code mode** checkbox. Keep the question or explanation
in the Markdown editor, select a programming language, and write the example in
the black editor below it. The editor supports syntax highlighting, matching
brackets, automatic indentation, and Tab indentation. Ctrl/Cmd+Enter saves the
whole card, including both examples.

Examples are stored as tagged Markdown fences in the existing `front` / `back`
columns. No database migration is needed. Editing a saved card restores its code
editors. Turning off Code mode removes that side's example after confirmation;
the original text remains.

The mobile review screen displays examples below the text in a black code block.
Reload the development app or rebuild an installed application to receive the
updated styling. Examples are displayed as text and are not executed.
