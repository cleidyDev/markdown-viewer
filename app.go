package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileData represents an opened markdown file
type FileData struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Content string `json:"content"`
	BaseDir string `json:"baseDir"`
}

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenFile shows a native file dialog and returns the selected markdown file
func (a *App) OpenFile() (*FileData, error) {
	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Abrir arquivo Markdown",
		Filters: []runtime.FileFilter{
			{DisplayName: "Markdown (*.md, *.markdown)", Pattern: "*.md;*.markdown;*.mdown"},
			{DisplayName: "Todos os arquivos (*)", Pattern: "*"},
		},
	})
	if err != nil {
		return nil, err
	}
	if file == "" {
		return nil, nil // usuário cancelou
	}
	return a.readFile(file)
}

// LoadFile loads a markdown file by path
func (a *App) LoadFile(path string) (*FileData, error) {
	return a.readFile(path)
}

// readFile reads a markdown file from disk
func (a *App) readFile(path string) (*FileData, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}
	return &FileData{
		Name:    filepath.Base(abs),
		Path:    abs,
		Content: string(content),
		BaseDir: filepath.Dir(abs),
	}, nil
}

// ResolveImagePath converts a relative image path to an absolute file:// URL
func (a *App) ResolveImagePath(baseDir, relPath string) string {
	if strings.HasPrefix(relPath, "http://") || strings.HasPrefix(relPath, "https://") ||
		strings.HasPrefix(relPath, "file://") || strings.HasPrefix(relPath, "data:") {
		return relPath
	}
	abs, err := filepath.Abs(filepath.Join(baseDir, relPath))
	if err != nil {
		return relPath
	}
	return "file://" + abs
}
