#!/bin/bash
 docker run --name jekyll --rm -p 4000:4000 -v ~/src/fernandoipar.com:/src/ -e jekyll_command=serve -it fipar/fernandoipar.com:v1 
