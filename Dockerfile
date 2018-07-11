# Jekyll and other gems needed to generate fernandoipar.com
# To build use:
# docker build -t fipar/fernandoipar.com:v1 .
# To run use:
# docker run --name jekyll --rm -p 4000:4000 -v ~/src/fernandoipar.com:/src/ -e jekyll_command=serve -it fipar/fernandoipar.com:v1 
# docker run --name jekyll --rm -p 4000:4000 -v ~/src/fernandoipar.com:/src/ -e jekyll_command=build -it fipar/fernandoipar.com:v1 
FROM jekyll/jekyll
MAINTAINER Fernando Ipar <fipar at acm.org>
LABEL description="A linux environment to generate fernandoipar.com"

ENV jekyll_command build
RUN gem install redcarpet jemoji jekyll-redirect-from jekyll-paginate 
RUN mkdir /src
WORKDIR /src
CMD ["/bin/bash", "-c", "jekyll ${jekyll_command}"]
