/**
 * Copyright (c) 2010 Arnaud Leymet
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Chrome Tab Sugar <http://github.com/arnaud/chrome-tab-sugar>
 */

/**
 * UTILITY FUNCTIONS
 */

// opens the Tab Sugar dashboard
function openDashboard() {
    console.debug('chrome.browserAction.onClicked');

    // URL of the Sugar Tab dashboard
    var sugar_url = chrome.extension.getURL("sugar.html");

    var updated = false;

    // check wether Sugar Tab is already opened in the current window
    chrome.windows.getCurrent(function (cur_win) {
        var wid = cur_win.id;
        getWindowWithTabs(wid, function (window) {
            for (var t in window.tabs) {
                var tab = window.tabs[t];
                if (tab.url == sugar_url) {
                    // reuse the last dashboard and reload it
                    chrome.tabs.update(tab.id, {url: sugar_url, selected: true});
                    updated = true;
                }
            }
            if (!updated) {
                // no dashboard were reused
                chrome.tabs.getSelected(wid, function (tab) {
                    if (tab.url == 'chrome://newtab/') {
                        // let's reuse the current 'new tab' tab
                        chrome.tabs.update(tab.id, {url: sugar_url, selected: true});
                    } else {
                        // let's create a new tab
                        chrome.tabs.create({url: sugar_url});
                    }
                });
            }
        }, function () {
            // couldn't find the current window?!?
            chrome.tabs.create({url: sugar_url});
        });
    });
}

// captures the current tab as a 320px-width JPEG snapshot
function captureCurrentTab() {
    console.debug('captureCurrentTab');
    chrome.windows.getCurrent(function (window) {
        chrome.tabs.getSelected(null, function (tab) {
            if (SugarTab.persistable(tab.url)) {
                chrome.tabs.captureVisibleTab(null, {format: 'jpeg'}, function (dataUrl) {
                    var sourceImage = new Image();
                    sourceImage.onload = function () {
                        // source
                        var sw = this.width;
                        var sh = this.height;
                        var s_scale = sw / sh;
                        // destination
                        var d_scale = 14 / 12;
                        var dw = 320;
                        var dh = Math.round(dw / d_scale);
                        // cropping
                        if (s_scale >= d_scale) {
                            sw = Math.round(sh * d_scale);
                        } else {
                            sh = Math.round(sw / d_scale);
                        }
                        // create a canvas with the desired dimensions
                        var canvas = document.createElement('canvas');
                        canvas.width = dw;
                        canvas.height = dh;
                        var ctx = canvas.getContext("2d");

                        // scale, crop and draw the source image to the canvas
                        ctx.drawImage(this, 0, 0, sw, sh, 0, 0, dw, dh);

                        // update the preview in the db
                        var t = new SugarTab(tab);
                        t.update_preview(dataUrl);
                        // let's request the extension to update the preview accordingly
                        chrome.extension.sendRequest({action: "update tab preview", tab: tab, preview: dataUrl});
                        // also let's update the current 'groups' instance with the new preview
                        for (var g in groups) {
                            var group = groups[g];
                            for (var t in group.tabs) {
                                var tab2 = group.tabs[t];
                                if (tab2.url == tab.url) {
                                    groups[g].tabs[t].preview = dataUrl;
                                }
                            }
                        }
                    };
                    sourceImage.src = dataUrl;
                });
            }
        });
    });
}

// get the extension version
function getVersion() {
    var version = 'NaN';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', chrome.extension.getURL('manifest.json'), false);
    xhr.send(null);
    var manifest = JSON.parse(xhr.responseText);
    return manifest.version;
}


/**
 * WINDOWS, TABS AND GROUPS
 */

// checks whether the group matches the window
// @param exceptionTab: optional, a tab that is contained by the window but that
// must not be part of the comparison
function compareGroupAndWindow(group, window, exceptionTab) {
    //console.debug('compareGroupAndWindow', group, window);
    var tabs = window.tabs;
    var window_tabs = [];
    for (var t in tabs) {
        var tab = tabs[t];
        //if(SugarTab.persistable(t.url)) {
        /*if(exceptionTab!=null && tab.id == exceptionTab.id) {
         // do nothing
         } else*/ //if(tab.status == 'loading') {
        // do nothing
        //} else {
        window_tabs.push(tab);
        //}
        //}
    }
    //console.debug('...has', window_tabs.length, 'tabs');
    //console.debug('...whereas the group has', group.tabs.length, 'tabs');
    if (window_tabs.length == group.tabs.length) {
        //console.debug('=> OK!');
        // 1st test is OK: the group and the window have the same tabs count
        var same_tabs = true;
        for (var t in window_tabs) {
            var wtab = window_tabs[t];
            var gtab = group.tabs[t];
            //console.debug(' tabs', '#'+t, wtab, gtab);
            same_tabs = wtab.url == gtab.url;
            if (!same_tabs) {
                //console.debug(' ... are not the same');
                break;
            }
        }
        if (same_tabs) {
            // 2nd test is OK: the group tabs and the window tabs share the same characteristics
            console.debug('Matching:', 'group', group, 'window', window);
            return true;
        }
    } else {
        //console.debug('=> KO');
        return false;
    }
}

// get a window with all its tabs populated
function getWindowWithTabs(wid, success, error) {
    console.debug('getWindowWithTabs', wid);
    chrome.windows.getAll({populate: true}, function (windows) {
        for (var w in windows) {
            var window = windows[w];
            if (window.id == wid) {
                success(window);
                return;
            }
        }
        if (error) error();
    });
}

// finds out which group corresponds to a window id
function getGroupFromWid(wid, callback) {
    console.debug('getGroupFromWid', wid);
    var gid = parseInt(sessionStorage['w' + wid]);
    console.debug('getGroupFromWid', 'gid=', gid);
    if (gid == null || isNaN(gid)) {
        console.warn('Group not found for window #' + wid);
        return;
    }
    var group = getGroupFromGid(gid);
    if (group != null) callback(group);
}

// finds out which window corresponds to a group id
function getWindowFromGid(gid, callback, error) {
    console.debug('getWindowFromGid', gid);
    var wid = parseInt(sessionStorage['g' + gid]);
    console.debug('getWindowFromGid', 'wid=', wid);
    if (wid == null || isNaN(wid)) {
        console.warn('Window not found for group #' + gid);
        if (error) error();
        return;
    }
    getWindowWithTabs(wid, function (window) {
        bindWindowToGroup(wid, gid);
        callback(window);
    }, error);
}

// binds a window to a group in the session storage
function bindWindowToGroup(wid, gid) {
    sessionStorage['g' + gid] = wid;
    sessionStorage['w' + wid] = gid;
}

// binds a window to a tab in the session storage
function bindWindowToTab(wid, tid) {
    sessionStorage['t' + tid] = wid;
}

// let windows and groups match together
// also keep a trace of tids and their matching gids
function matchWindowsAndGroups(callback) {
    console.debug('matchWindowsAndGroups');
    chrome.windows.getAll({populate: true}, function (windows) {
        for (var w in windows) {
            var window = windows[w];
            // match window/group
            for (var g in groups) {
                var group = groups[g];
                if (compareGroupAndWindow(group, window)) {
                    bindWindowToGroup(window.id, group.id);
                }
            }
            // match tab/window
            for (var t in window.tabs) {
                var tab = window.tabs[t];
                bindWindowToTab(tab.id, window.id);
            }
        }
        if (callback) callback();
    });
}

// finds out which tab corresponds to a group id and index
function getTabFromTid(gid, index, callback, error) {
    console.debug('getTabFromTid', gid, index);
    getWindowFromGid(gid, function (window) {
        var tab_found = false;
        var tab = null;
        var idx = 0;
        for (var t in window.tabs) {
            tab = window.tabs[t];
            //if(SugarTab.persistable(t.url)) {
            idx++;
            //}
            if (idx == index) {
                tab_found = true;
                break;
            }
        }
        if (tab_found) {
            callback(window, tab);
        } else {
            console.error('Couldn\'t find a match for the tab', gid, index);
            if (error) error();
        }
    }, error);
}

// find the window a tab belongs to
function getWidFromTid(tid, callback) {
    console.debug('getWidFromTid', tid);
    // 1. Look for the wid in the session storage, if it was stored in before
    var wid = sessionStorage['t' + tid];
    if (wid != null) {
        wid = parseInt(wid);
        getWindowWithTabs(wid, function (window) {
            callback(wid, window);
        });
        return;
    }
    // 2. Look for the current windows
    chrome.windows.getAll({populate: true}, function (windows) {
        for (var w in windows) {
            var window = windows[w];
            for (var t in window.tabs) {
                var tab = window.tabs[t];
                if (tab.id == tid) {
                    callback(window.id, window);
                    return;
                }
            }
        }
    });
}

// find a group by its id
function getGroupFromGid(gid) {
    console.debug('getGroupFromGid', gid);
    for (var g in groups) {
        var group = groups[g];
        if (group.id == gid) {
            return group;
        }
    }
    console.error('Couldn\'t find the group', gid);
    return null;
}

// compares two tabs
function tabsIdentical(tab1, tab2) {
    return tab1.url == tab2.url;// && tab1.index == tab2.index;
}

// look for the difference between two tabsets
function diffTabs(gtabs, wtabs) {
    var diff = [];
    var gt = 0;
    var max_gtabs = gtabs.length;
    for (var wt in wtabs) {
        var wtab = wtabs[wt];
        var gtab = gtabs[gt];
        if (!tabsIdentical(gtab, wtab)) {
            diff.push(gtab);
            wt--;
        }
        gt++;
        if (parseInt(wt) == wtabs.length - 1 || gt > max_gtabs) {
            // end of windows tabs
            for (var i = parseInt(gt); i < gtabs.length; i++) {
                // some group tabs left
                gtab = gtabs[i];
                diff.push(gtab);
            }
            break;
        }
    }
    return diff;
}

// syncs the the 'groups' variable with the ones from the database
function syncGroupsFromDb(callback) {
    console.debug('SYNC');
    groups = [];
    SugarGroup.load_groups({
        success: function () {
            // let the windows and groups make a match
            matchWindowsAndGroups();
            // do our little thing
            if (callback) callback();
        }
    });
}
