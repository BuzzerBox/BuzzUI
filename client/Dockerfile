# thanks to Lukas Marx, https://malcoded.com/posts/angular-docker/

######
# CAUTION: The build context is set to the parent directoy in order to be able to work with the shared/ directory.
#          Thus, we need to explicitly enter the client's directory
######

LABEL version="0.0.1"
LABEL description="Image for the buzzer web UI frontend"

ARG dirClient=client
ARG workDir=/usr/buzzerWebUI/$dirClient

# build angular app
FROM node:current-alpine3.13 as node
#if you change this, also change this in the next stage
# leaving it without a value to have it inherit the globally set value
ARG workDir
ARG dirClient
WORKDIR $workDir
# WORKDIR /src/app
# copy both, the package.json and the package.lock.json, into the image
COPY $dirClient/package.json ./
COPY $dirClient/package-lock.json ./
COPY shared ../shared/
# then run npm install to install all dependencies of the project
RUN npm i --production
# we copy the rest of the project into the image
COPY $dirClient/ .
COPY config.json ../
# run the serve build of the angular project
RUN npm run build


# serve built angular app
FROM nginx:1.21.0-alpine
# leaving them without a value to have them inherit the globally set values
ARG dirClient
ARG workDir
# remove the nginx's defaultly served files
RUN rm -f /usr/share/nginx/html/*
# copy ng build's output to html folder to be served
COPY --from=node $workDir/dist/$dirClient /usr/share/nginx/html
# copy nginx config file
COPY $dirClient/nginx.conf /etc/nginx/conf.d/default.conf
