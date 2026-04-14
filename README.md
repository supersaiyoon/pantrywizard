# pantrywizard

## Team 8 group project for CST 336 at CSUMB.

### Initial set up

To start working on this project, pull the repository and open a terminal then run

`npm install`

Then set up set up the .env file with the following format with the information shared database

```
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
```

To test the database connection go to: http://localhost:4000/dbtest

### Running the project

`node index.mjs`

Navigate to the site, it should be: http://localhost:4000


### Working on the project

#### Working with github desktop

Working with github desktop is a bit easier, and there are good guides out there that are more visual
Visit: https://docs.github.com/en/desktop/making-changes-in-a-branch/managing-branches-in-github-desktop

#### Working with git in the cli

Create a new branch

```
# Create a new branch
git branch <name>
# Checkout your new feature branch
git checkout <name>
```

Write code, commit changes

```
# Add all files to the stage
git add .
# Commit files 
git commit -m "Description of this commit"
# Push local branch to remote
git push origin <name>
```

Merge your changes

```
#fetch latest changes
git pull
#check out master
git checkout master
# Merge <name> INTO master
# May have to do some manual work here to merge the branches
git merge <name>
```

Push changes to remote

```
git push origin master
```



