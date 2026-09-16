The browser check downloads the real HEIC example from the libheif project:
https://github.com/strukturag/libheif/blob/master/examples/example.heic

Other fixtures are generated in memory. Tests cover genuine JPEG, PNG, WebP,
AVIF, GIF, TIFF, BMP and HEIC bytes; blank/nonstandard MIME; mismatched extension;
empty, oversized, fake and truncated files; complete form submission.
The local HEIC download is ignored by git. Browser tests mock the delivery API
and never create real service requests. Live delivery is verified separately.
