# Test harnesses

These run under Node against the files in `app/`, from the directory above this
one:

    node tests/chdelete.test.js

They are packaged with the app on purpose. They used to live outside it and
were lost when a working container reset — the app survived because it was
zipped, the tests did not because they were not.

Most assert on the source rather than running the whole app: the failures worth
catching here are "this screen no longer offers the thing it used to" and "this
push names a screen that does not exist", which a source check catches cheaply
and a browser test catches slowly.
