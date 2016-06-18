package main

import "fmt"
import "github.com/labstack/echo"
import "github.com/labstack/echo/middleware"
import "github.com/labstack/echo/engine/standard"

type Context struct{}

type BaseController struct{}

func getNewBaseController(ctx *Context, logger Logger) *BaseController {
	return &BaseController{}
}

type tmpLogger struct{}

func (t *tmpLogger) WithField(key string, value interface{}) Logger {
	fmt.Println(fmt.Sprintf("[%s]=%v", key, value))
	return t
}

type postResource struct{}

func (p *postResource) RetrieveAPost(postId string) (*RetrieveAPostResult, error) {
	return NewRetrieveAPostResult("123", "", "", "", false, nil, "", 0, 0, 0, false, false), nil
}
func (p *postResource) DeleteAPost(postId string) (*DeleteAPostResult, error) {
	return NewDeleteAPostResult(), nil
}

type postsCollectionResource struct{}

func (p *postsCollectionResource) CreateAPost(postData *CreateAPostInput) (*CreateAPostResult, error) {
	return NewCreateAPostResult(postData.Id, "", "", "", false, nil, "", 0, 0, 0, false, false), nil
}
func (p *postsCollectionResource) RetrieveAllPosts() (*RetrieveAllPostsResult, error) {
	return NewRetrieveAllPostsResult("data-456", nil), nil
}

type starsResource struct{}

func (s *starsResource) StarAPost(postId int64) (*StarAPostResult, error) {
	return NewStarAPostResult("678", "", "", "", false, nil, "", 0, 0, 0, false, false), nil
}
func (s *starsResource) UnstarAPost(postId int64) (*UnstarAPostResult, error) {
	return NewUnstarAPostResult("890", "", "", "", false, nil, "", 0, 0, 0, false, false), nil
}

func main() {
	debugMode := true
	addr := ":8080"

	e := echo.New()
	if debugMode {
		e.SetDebug(true)
	}

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	ctrlAdder := &controllerAdder{
		Logger: &tmpLogger{},
		Ctx:    &Context{},
	}

	postResource := &postResource{}
	postsCollectionResource := &postsCollectionResource{}
	starsResource := &starsResource{}
	RegisterRouters(ctrlAdder, e, postResource, postsCollectionResource, starsResource)

	fmt.Println(fmt.Sprintf("Serving on %s", addr))
	e.Run(standard.New(addr))
}
