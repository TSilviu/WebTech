"use strict";
// Sample express web server.  Supports the same features as the provided server,
// and demonstrates a big potential security loophole in express.

var express = require("express");
var session = require('express-session');
var app = express();
var fs = require("fs");
var path = require("path");
var sql = require("sqlite3").verbose();
var dbpath = path.resolve('public/db/', 'site.db');
console.log(dbpath);
var db = new sql.Database(dbpath);

var banned = [];
banUpperCase("./public/", "");

// Define the sequence of functions to be called for each request.  Make URLs
// lower case, ban upper case filenames, require authorisation for admin.html,
// and deliver static files from ./public.
app.use(lower);
app.use(ban)
app.use("/admin.html", auth);
var options = { setHeaders: deliverXHTML };
app.use(express.static("public", options));

console.log("About to initialise the session");
app.use(session({
  secret: 'ssshhhh',
  resave: false,
  saveUninitialized: true,
  cookie: {maxAge: 60000}
}));
console.log("session initialised");

app.listen(8080, "localhost");
console.log("Visit http://localhost:8080/");
// set the view engine to ejs
app.set('view engine', 'ejs');

/*Global Variables*/
var categories = [1,2,3];   //Hardcoded for the current category types
var postsPerCategory = [4, 4, 6];    //Hardcoded for the current layout
var categoriesNames = {
    1: 'Programming',
    2: 'Digital Device',
    3: 'Software'
};

function createPost(post, tableRow) {
    post['id'] = tableRow.postID;
    post['title'] = tableRow.title;
    post['description'] = tableRow.introduction;
    post['imageUrl'] = tableRow.imagePath;
    post['categoryId'] = tableRow.category;
    post['categoryName'] = categoriesNames[tableRow.category];

    return post;
}

app.get('/index.html', function(req, res) {
    var sess = req.session;
    if (sess.loggedIn){
      console.log("Already loggedIn");
    }
    else {
      console.log("haven't logged yet");
    }
    var categoriesPosts = [];

    db.all('select * from posts order by postID desc', handler);

    //db.all("select * from posts where category = '1'", handler);

    function handler(err, table) {
        if (err) throw err;
        for(var categoryId = 1; categoryId<=categories.length; categoryId++) {
            var posts = [];
            for(var row = 0; row < table.length; row++) {
                var post = {};
                if(table[row].category == categoryId) {
                    createPost(post, table[row]);
                    if(posts.length < postsPerCategory[categoryId - 1]) {
                        posts.push(post);
                    } else {
                        break;
                    }
                }
            }
            categoriesPosts.push(posts)
        }
        res.render('pages/index', {
            categoriesPosts: categoriesPosts
        });
    }
});

app.get('/category.html/id=:id', function(req, res) {
    var posts = [];
    var categoryId = req.params.id;

    db.all('select * from posts order by postID desc', handler);

    function handler(err, table) {
        if (err) throw err;
        for(var row = 0; row < table.length; row++) {
            var post = {};
            createPost(post, table[row]);
            if(categoryId == post['categoryId']) {
                posts.push(post);
            }
        }
        res.render('pages/category', {
            posts: posts
        });
    }
});

app.get('/edit_post.html', function(req, res) {
    res.render('pages/edit_post');
});

app.get('/read_post.html/id=:id', function(req, res) {
    var content = {};
    var postId = req.params.id;

    db.get('select * from posts where postId= ?', postId, handler);

    function handler(err, row)
    {
        content['title'] = row.title;
        content['imagePath'] = row.imagePath;
        content['textContent'] = row.content;

        res.render('pages/read_post', {
            content: content
        });
    }
});

// login / register
app.post('/login', loginRequestHandler);
function loginRequestHandler(req, res) {
    var sess = req.session;
    var body = "";
    req.on('data', add);
    req.on('end', end);
    var response = {};
    function add(chunk){
        body = body + chunk.toString();
    }

    function end(){
        body = JSON.parse(body);

        db.get("select * from user where username= ?", body.userName, handler);

        function handler(err, row){
            if (err)  throw err;

            if (row === undefined) {
              response.loginResponse = "No such user";
            }
            else if(row.password === body.password) {
              sess.userName = body.userName;
              sess.loggedIn = true;
              response.loginResponse = "Successfully LoggedIn";
              response.imageIcon = row.imgURL;
            }
            else {
              response.loginResponse = "Incorrect Password";
            }
            res.send(JSON.stringify(response));
        }

    }
}

// Make the URL lower case.
function lower(req, res, next) {
    req.url = req.url.toLowerCase();
    next();
}

// Forbid access to the URLs in the banned list.
function ban(req, res, next) {
    for (var i=0; i<banned.length; i++) {
        var b = banned[i];
        if (req.url.startsWith(b)) {
            res.status(404).send("Filename not lower case");
            return;
        }
    }
    next();
}

// Redirect the browser to the login page.
function auth(req, res, next) {
    res.redirect("/login.html");
}

// Called by express.static.  Deliver response as XHTML.
function deliverXHTML(res, path, stat) {
    if (path.endsWith(".ejs")) {
        res.header("Content-Type", "application/xhtml+xml");
    }
}

// Check a folder for files/subfolders with non-lowercase names.  Add them to
// the banned list so they don't get delivered, making the site case sensitive,
// so that it can be moved from Windows to Linux, for example. Synchronous I/O
// is used because this function is only called during startup.  This avoids
// expensive file system operations during normal execution.  A file with a
// non-lowercase name added while the server is running will get delivered, but
// it will be detected and banned when the server is next restarted.
function banUpperCase(root, folder) {
    var folderBit = 1 << 14;
    var names = fs.readdirSync(root + folder);
    for (var i=0; i<names.length; i++) {
        var name = names[i];
        var file = folder + "/" + name;
        if (name != name.toLowerCase()) banned.push(file.toLowerCase());
        var mode = fs.statSync(root + file).mode;
        if ((mode & folderBit) == 0) continue;
        banUpperCase(root, file);
    }
}

function generatePosts() {
    /*insert database query here*/
    /*create array of posts here*/
}
