package main

import "fmt"

type Context struct{}

type BaseController struct{}

func getNewBaseController(ctx *Context, logger localLogger) *BaseController {
	return &BaseController{}
}

func main() {
	fmt.Println("Build Success!")
}
