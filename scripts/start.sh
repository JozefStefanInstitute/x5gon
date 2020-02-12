# go to project base
cd ..

###########################################################
# Cleanup all of the processes
###########################################################

# stop all processes
pm2 stop all
pm2 delete all

# install all node packages
npm install


###########################################################
# Reload docker containers
###########################################################

# reload the docker container (with persistent data)
cd docker/
sh run-docker.sh
cd ..


###########################################################
# Prepare submodule components
###########################################################

# rebuild the frontend
cd src/services/platform/frontend
npm install
npm run-script build
cd ../../../..


# reload the search engine system
cd src/services/search
npm install
pm2 reload ecosystem.config.json --env production
cd ../../..


###########################################################
# Prepare main components
###########################################################

# reload the recommender engine system
pm2 reload ecosystem.recsys.config.json --env production

# reload the processing pipelines
cd src/services/preproc

pm2 reload ecosystem.process.collect.config.json --env production
pm2 reload ecosystem.process.text.config.json    --env production
pm2 reload ecosystem.process.video.config.json   --env production
pm2 reload ecosystem.process.store.config.json   --env production

#pm2 reload ecosystem.update.collect.config.json --env production
#pm2 reload ecosystem.update.text.config.json    --env production
#pm2 reload ecosystem.update.video.config.json   --env production
#pm2 reload ecosystem.update.store.config.json   --env production

cd ../../..

# reload the platform
pm2 reload ecosystem.platform.config.json --env production


###########################################################
# Post-processing
###########################################################

# save the process configurations for running the services
pm2 save