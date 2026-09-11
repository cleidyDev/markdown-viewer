package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileData represents an opened markdown file
type FileData struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Content string `json:"content"`
	BaseDir string `json:"baseDir"`
}

// RecentItem represents a recently opened file entry
type RecentItem struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	LastOpened int64  `json:"lastOpened"`
}

// maxRecents limits how many entries are kept in the recents list
const maxRecents = 20

// App struct
type App struct {
	ctx       context.Context
	stopWatch chan struct{}
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the application starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.stopWatch = make(chan struct{})
	a.openFromArgs()
}

// shutdown closes the file watcher when the app exits
func (a *App) shutdown(_ context.Context) {
	if a.stopWatch != nil {
		close(a.stopWatch)
	}
}

// openFromArgs opens a file passed on the command line, if any
func (a *App) openFromArgs() {
	if len(os.Args) < 2 {
		return
	}
	path, err := filepath.Abs(os.Args[1])
	if err != nil {
		return
	}
	if _, err := os.Stat(path); err != nil {
		return
	}
	go func() {
		time.Sleep(500 * time.Millisecond) // aguarda o frontend carregar
		runtime.EventsEmit(a.ctx, "open-path", path)
	}()
}

// watchFile watches the file's directory and emits "file:changed" when the
// file is modified on disk (debounced). Watching the directory handles
// editors that replace the file atomically on save.
func (a *App) watchFile(path string) {
	if a.stopWatch != nil {
		close(a.stopWatch)
	}
	stop := make(chan struct{})
	a.stopWatch = stop

	w, err := fsnotify.NewWatcher()
	if err != nil {
		return
	}
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	if err := w.Add(dir); err != nil {
		w.Close()
		return
	}
	go func() {
		defer w.Close()
		var last time.Time
		for {
			select {
			case <-stop:
				return
			case ev, ok := <-w.Events:
				if !ok {
					return
				}
				if filepath.Base(ev.Name) != base {
					continue
				}
				if ev.Op&(fsnotify.Write|fsnotify.Create) == 0 {
					continue
				}
				if time.Since(last) < 300*time.Millisecond {
					continue
				}
				last = time.Now()
				runtime.EventsEmit(a.ctx, "file:changed", path)
			case _, ok := <-w.Errors:
				if !ok {
					return
				}
			}
		}
	}()
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
	a.recordRecent(abs)
	a.watchFile(abs)
	return &FileData{
		Name:    filepath.Base(abs),
		Path:    abs,
		Content: string(content),
		BaseDir: filepath.Dir(abs),
	}, nil
}

// getRecentsPath returns the path of the recents config file
func (a *App) getRecentsPath() string {
	cfgDir, err := os.UserConfigDir()
	if err != nil {
		home, _ := os.UserHomeDir()
		cfgDir = filepath.Join(home, ".config")
	}
	return filepath.Join(cfgDir, "markdown-viewer", "recents.json")
}

// loadRecents reads the recents list from disk, dropping entries whose
// files no longer exist on disk
func (a *App) loadRecents() []RecentItem {
	data, err := os.ReadFile(a.getRecentsPath())
	if err != nil {
		return []RecentItem{}
	}
	var items []RecentItem
	if err := json.Unmarshal(data, &items); err != nil {
		return []RecentItem{}
	}
	filtered := make([]RecentItem, 0, len(items))
	for _, it := range items {
		if _, err := os.Stat(it.Path); err == nil {
			filtered = append(filtered, it)
		}
	}
	return filtered
}

// saveRecents writes the recents list to disk
func (a *App) saveRecents(items []RecentItem) {
	path := a.getRecentsPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(path, data, 0o644)
}

// recordRecent adds/updates a file entry at the top of the recents list
func (a *App) recordRecent(path string) {
	items := a.loadRecents()
	updated := make([]RecentItem, 0, len(items)+1)
	updated = append(updated, RecentItem{
		Name:       filepath.Base(path),
		Path:       path,
		LastOpened: time.Now().Unix(),
	})
	for _, it := range items {
		if it.Path != path {
			updated = append(updated, it)
		}
	}
	if len(updated) > maxRecents {
		updated = updated[:maxRecents]
	}
	a.saveRecents(updated)
}

// GetRecentFiles returns the list of recently opened files (newest first)
func (a *App) GetRecentFiles() []RecentItem {
	return a.loadRecents()
}

// ClearRecentFiles empties the recents list
func (a *App) ClearRecentFiles() {
	a.saveRecents([]RecentItem{})
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
