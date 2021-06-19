ARG DIR_SERVER=server
ARG WORK_DIR=/usr/buzzerWebUI/$DIR_SERVER
ARG ARCH=amd64

# In this image, we transpile the typescript to javascript
FROM $ARCH/node:current-alpine3.13 as node
ARG ARCH
LABEL version="0.0.1"
LABEL description="Image for the buzzer web UI backend server"
ARG WORK_DIR
ARG DIR_SERVER
WORKDIR $WORK_DIR
# copy the package.json and ther ts.config into the image
COPY $DIR_SERVER/package.json ./
COPY $DIR_SERVER/tsconfig.json ./
# then run npm install in productive mode to install all dependencies of the project
#RUN npm i  --production
RUN npm i
# Add all the content to the WORKDIR
COPY $DIR_SERVER ./
COPY shared ../shared/
COPY config.json ../
# finally transpile the source
RUN npx tsc --outDir ./dist
RUN echo $(ls)
# RUN npx tsc
# RUN the server
CMD ["node","./dist/server/main.js"]
# Expose the port to make communication with the API from the outside world possible
EXPOSE 4201
