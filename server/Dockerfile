# extra metadata
#LABEL version="0.1"
#LABEL description="Image for the OER Tool Backend"

# In this image, we transpile the typescript to javascript
FROM node:12.13-alpine as node
ENV DIR=/usr/src/app
WORKDIR $DIR
# copy the package.json and ther ts.config into the image
COPY package.json $DIR
COPY tsconfig.json $DIR
# then run npm install in productive mode to install all dependencies of the project
RUN npm i  --production
# Add all the content to the WORKDIR
ADD . /usr/src/app
# finally transpile the source
RUN npx tsc --outDir $DIR/dist
# RUN the server
CMD ["node","./dist/server.js"]
# Expose the port to make communication with the API from the outside world possible
EXPOSE 4201



#FROM node:12.13-alpine as node2
#ENV DIR=/usr/src/app
#WORKDIR $DIR
#COPY --from=node $DIR/dist $DIR
#CMD ["node","/usr/src/app/server.js"]
