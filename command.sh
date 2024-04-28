#!/bin/bash
command=$1
shift
 docker run --name jekyll --rm -p 4000:4000 -v ~/src/fernandoipar.com:/src/ -e jekyll_command="$command $*" -it fipar/fernandoipar.com:v1
