function OS_TextEditor() {
    var _this = this;

    // properties
    _this._regexList = {
        allKindOfWhiteSpaces: /\s/g,
        whiteSpaceAtTheEnd: /\s+$/,
        textInsideDubbleBreakets: /\{{(.*?)\}}/,
    };
    
    _this._defaultOptions = {
        element: ".os_texteditor_wrapper",
        dictionary: [],
    };

    _this._itemWrapper = "";
    _this._itemTextArea = "";
    _this._itemTextWrapper = "";
    _this._itemListOptionsContainer = "";
    _this._itemSelectedListOptionIndex = "";

    _this._carretLastPosition = 0;
    _this._phraseOnCaretContextParts = {
        htmlBlocks: []
    };
    _this._inputTextCaretLeftWord = "";
    _this._updatedText = false;
    _this._dictionaryToWorkWith = [];
    _this._dictionarySymbols = [];
    _this._dictionarySymbolToWorkWith = "";
    _this._deviceType = "";

    // methods
        // Destroy/clean all Events, and all variables
    var destroy = function(){
            // remove all events
            _this._itemTextWrapper.removeEventListener('keyup', onInputTextChange);
            _this._itemTextWrapper.removeEventListener('click', clickOnInputText);

            // wait to remove
            // setTimeout(function(){
                // remove elements from content
                _this._itemWrapper.remove();
                // clean all properties
                _this = "";
            // }, 400);
        },

        // get caret position inside element
        getCaretPosition = function(el) {
            var ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
            var w3 = (typeof window.getSelection != "undefined") && true;
            var caretOffset = 0;
            if (w3) {
                var range = window.getSelection().getRangeAt(0);
                var preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(el);
                preCaretRange.setEnd(range.endContainer, range.endOffset);
                caretOffset = preCaretRange.toString().length;
            }
            else if (ie) {
                var textRange = document.selection.createRange();
                var preCaretTextRange = document.body.createTextRange();
                preCaretTextRange.expand(el);
                preCaretTextRange.setEndPoint("EndToEnd", textRange);
                caretOffset = preCaretTextRange.text.length;
            }
            return caretOffset;
        },

        // set caret position inside element
        setCaretPos = function (el, sPos){
            var charIndex = 0, range = document.createRange();
            range.setStart(el, 0);
            range.collapse(true);
            var nodeStack = [el], node, foundStart = false, stop = false;
            while (!stop && (node = nodeStack.pop())) {
                if (node.nodeType == 3) {
                    var nextCharIndex = charIndex + node.length;
                    if (!foundStart && sPos >= charIndex && sPos <= nextCharIndex) {
                        range.setStart(node, sPos - charIndex);
                        foundStart = true;
                    }
                    if (foundStart && sPos >= charIndex && sPos <= nextCharIndex) {
                        range.setEnd(node, sPos - charIndex);
                        stop = true;
                    }
                    charIndex = nextCharIndex;
                } else {
                    var i = node.childNodes.length;
                    while (i--) {
                        nodeStack.push(node.childNodes[i]);
                    }
                }
            }
            selection = window.getSelection();                 
            selection.removeAllRanges();                       
            selection.addRange(range);
        },

        // trigger event
        triggerEvent = function(el, value){
            var inputTypes = [
                window.HTMLInputElement,
                window.HTMLSelectElement,
                window.HTMLTextAreaElement,
            ];
            
            // only process the change on elements we know have a value setter in their constructor
            if ( inputTypes.indexOf(el.__proto__.constructor) > -1 ) {
                var setValue = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set;
                var event = new Event('input', { bubbles: true });
                setValue.call(el, value);
                el.dispatchEvent(event);
            }
        },

        // clean Html Entities from string
        stripHtml = function(text){
            // Create a new div element
            var tempDivElement = document.createElement("div");
            // Set the HTML content with the providen
            tempDivElement.innerHTML = text;
            // Retrieve the text property of the element (cross-browser support)
            return tempDivElement.textContent || tempDivElement.innerText || "";
        },

        // function to remove one and specific last instance of one text, and retrive a new string without it
        removeWordFromText = function(str, removeWord){
            var charpos = str.lastIndexOf(removeWord);
            if (charpos<0) return str;
            var leftW = str.substring(0,charpos),
                rightW = str.substring(charpos+(removeWord.length)),
                totalW = leftW + rightW;
            return totalW;
        },

        // function to update total text and keep html tags
        updateTotalText = function(str){
            // check if the _phraseOnCaretContextParts object already exists
            if(!_this._phraseOnCaretContextParts.totalPhrase){
                _this._phraseOnCaretContextParts.totalPhrase = str;
            }
            else{
                // check if we have something to replace for
                if(_this._phraseOnCaretContextParts.htmlBlocks.length === 0){
                    _this._phraseOnCaretContextParts.totalPhrase = str;
                }
                else{
                    // check for all of elements to replace in totalPhrase and replace them
                    for(var i=0; i<_this._phraseOnCaretContextParts.htmlBlocks.length; i++){
                        // check if the item don't exist in our text, if don't remove it
                        if(str.indexOf(_this._phraseOnCaretContextParts.htmlBlocks[i].info) === -1){
                            _this._phraseOnCaretContextParts.htmlBlocks.splice(i, 1);
                        }
                        else{
                            // we have info to replace
                            var regex = new RegExp(_this._phraseOnCaretContextParts.htmlBlocks[i].info, 'gi');
                            if(_this._phraseOnCaretContextParts.htmlBlocks[i].higlight){
                                str = str.replace(regex, "<mark class='higlight'>"+_this._phraseOnCaretContextParts.htmlBlocks[i].info+"</mark>");
                            }
                            else{
                                str = str.replace(regex, "<mark>"+_this._phraseOnCaretContextParts.htmlBlocks[i].info+"</mark>");
                            }
                        }
                    }
                    _this._phraseOnCaretContextParts.totalPhrase = str;
                }
            }
        },

        // save the text status before and after caret position
        updatePhraseInCarretContext = function(el){
            var carretPosition = getCaretPosition(el),
                el_value = stripHtml(el.innerHTML); 

            _this._phraseOnCaretContextParts.leftText = el_value.substr(0, carretPosition).replace(_this._regexList.allKindOfWhiteSpaces, " ");
            var leftTextWhiteSpaceAtEnd = _this._phraseOnCaretContextParts.leftText.match(_this._regexList.whiteSpaceAtTheEnd);
            if(leftTextWhiteSpaceAtEnd){
               _this._phraseOnCaretContextParts.leftTextLastWord = " ";
            }
            else{
                _this._phraseOnCaretContextParts.leftTextLastWord = _this._phraseOnCaretContextParts.leftText.split(" ")[_this._phraseOnCaretContextParts.leftText.split(" ").length-1];
            }
            _this._phraseOnCaretContextParts.rightText = el_value.substr(carretPosition, el_value.length);

            updateTotalText(el_value);
            // console.log(_this._phraseOnCaretContextParts);
        },

        // function used to replace text when user select one listItems option
        replaceTexOnSelectListOption = function(objSelected){
            // console.log(objSelected);
            var replaceTextMask = _this._dictionaryToWorkWith.settings.replacedMask,
                objKeys = Object.keys(objSelected),
                replacedText = false;

            // check if we have a mask to replace for
            if(!replaceTextMask){
                console.log("Not found replacedMask atribute");
                return false;
            }

            // check all item atributes if the mask has something to replace
            for(var i=0; i<objKeys.length; i++){
                var infoToReplace = replaceTextMask.match(_this._regexList.textInsideDubbleBreakets);

                // check if we have something to replace, and if yes, check if the name exist on object
                if(infoToReplace && objSelected[infoToReplace[1]]){
                    replaceTextMask = replaceTextMask.replace(infoToReplace[0], objSelected[infoToReplace[1]]);
                    replacedText = true;
                }
            }

            // check if we don't find nothing to replce
            if(!replaceTextMask){
                console.log("Not found any atributes with the name refered on Mask.");
                return false;
            }

            // check if we need to use the symbol or not
            if(_this._dictionaryToWorkWith.settings.useSymbolOnReplace){
                replaceTextMask = _this._dictionarySymbolToWorkWith + replaceTextMask;
            }

            // save added html reference to math width content later
            var itemAlreadyExist = false,
                itemSelected = {
                    info:replaceTextMask, 
                    higlight:_this._dictionaryToWorkWith.settings.higlightOnReplace
                };
            for(var j=0; j<_this._phraseOnCaretContextParts.htmlBlocks.length; j++){
                if(_this._phraseOnCaretContextParts.htmlBlocks[j] === itemSelected.info){
                    itemAlreadyExist = true;
                }
            }
            if(!itemAlreadyExist){
                _this._phraseOnCaretContextParts.htmlBlocks.push(itemSelected);
            }

            // remove the word to replace from text, and update
            var textWithoutRemovedWord = removeWordFromText(_this._phraseOnCaretContextParts.leftText, _this._phraseOnCaretContextParts.leftTextLastWord);
            updateTotalText(textWithoutRemovedWord + replaceTextMask + _this._phraseOnCaretContextParts.rightText);
            
            _this._updatedText = true;
            
            _this._itemTextWrapper.innerHTML = _this._phraseOnCaretContextParts.totalPhrase;
            // _this._itemTextArea.value = _this._itemTextWrapper.innerHTML;
            triggerEvent(_this._itemTextArea, _this._itemTextWrapper.innerHTML);
            
            // set caret position
            var leftText = textWithoutRemovedWord+replaceTextMask,
                leftTextLength = leftText.length;

            setCaretPos(_this._itemTextWrapper, leftTextLength);
            
            // set focus on textare
            _this._itemTextWrapper.focus();
            // reset info before close the listItems
            _this._itemSelectedListOptionIndex = 0;
            _this._itemListOptionsContainer.classList.remove("open");
        },

        // function to execute actions to use keyboard up/down arrows to navigate inside lists
        scrollOnListWithKeys = function(evt) {
            // check if user had pressed one key that isn't a up/down or enter key
            if(evt.keyCode !== 38 && evt.keyCode !== 40 && evt.keyCode !== 13){
                _this._itemTextWrapper.focus();
                _this._itemSelectedListOptionIndex = 0;
                _this._itemListOptionsContainer.removeEventListener('keydown', scrollOnListWithKeys);
                return false;
            }

            var itemToSelect = "";
            if(evt.keyCode === 38 && _this._itemSelectedListOptionIndex > 0){
                _this._itemSelectedListOptionIndex--;
            }
            if(evt.keyCode === 40 && _this._itemSelectedListOptionIndex < _this._itemListOptionsContainer.querySelectorAll("li").length-1){
                _this._itemSelectedListOptionIndex++;
            }
            itemToSelect = _this._itemListOptionsContainer.querySelectorAll("li")[_this._itemSelectedListOptionIndex];
            itemToSelect.focus();

            // when user press enter key
            if(evt.keyCode === 13 && _this._dictionaryToWorkWith.settings.listMask){
                replaceTexOnSelectListOption(_this._dictionaryToWorkWith.infoCollection[itemToSelect.getAttribute("dictionaryIndex")]);
            }
        },

        // create html list structure
        createHtmlListsStructure = function(){
            var htmlStructure = "", itemIndex = 0;

            // check if we are using a pattern to use with no text or not
            if(_this._dictionaryToWorkWith.settings.pattern && _this._phraseOnCaretContextParts.totalPhrase.indexOf(_this._dictionarySymbolToWorkWith) !== 0){
                return false;
            }

            // check if the _dictionaryToWorkWith has one mask to work with, and if mask has {{textInsideDubbleBreakets}}
            if(!_this._dictionaryToWorkWith.settings.listMask){
                console.log("Undefined mask. Create one and use {{valueToChange}} to change values inside it");
                return false;
            }

            // check if we don't have items to create one listStructure to show
            if(_this._dictionaryToWorkWith.infoCollection.length === 0){
                htmlStructure = "<li>"+_this._dictionaryToWorkWith.settings.listMask+"</li>";
            }
            else{
                // check all items inside our infoCollection
                for (var i=0; i<_this._dictionaryToWorkWith.infoCollection.length; i++){
                    var item = _this._dictionaryToWorkWith.infoCollection[i],
                        maskToReplace = _this._dictionaryToWorkWith.settings.listMask,
                        findFor = _this._phraseOnCaretContextParts.leftTextLastWord.replace(_this._dictionarySymbolToWorkWith, "").toLowerCase();

                    // check all info inside each item
                    for (var k=0; k<Object.keys(item).length; k++){
                        // check if we have something to change on mask
                        if(maskToReplace.match(_this._regexList.textInsideDubbleBreakets)){
                            var matchedInfo = maskToReplace.match(_this._regexList.textInsideDubbleBreakets);
                            maskToReplace = maskToReplace.replace(matchedInfo[0], item[matchedInfo[1]]);
                        }
                    }

                    // check for similar text on our content, show if we have something similar
                    if(stripHtml(maskToReplace).toLowerCase().indexOf(findFor) > -1){
                        itemIndex++;
                        htmlStructure += "<li tabindex='"+itemIndex+"' dictionaryIndex='"+i+"'>" + maskToReplace + "</li>";
                    }
                }
            }

            // check if we had made changes => we need to show something
            if(htmlStructure !== ""){
                var listsTitle = "";

                // check if we have a title to show
                if(_this._dictionaryToWorkWith.settings.listTitle && _this._dictionaryToWorkWith.settings.listTitle !== ""){
                    listsTitle = _this._dictionaryToWorkWith.settings.listTitle;

                    // check if we have text to replace on title
                    if(listsTitle.match(_this._regexList.textInsideDubbleBreakets)){
                         listsTitle = listsTitle.replace(listsTitle.match(_this._regexList.textInsideDubbleBreakets)[0], _this._phraseOnCaretContextParts.leftTextLastWord);
                    }
                }

                // check if we have title to show or not
                if(listsTitle !== ""){
                    htmlStructure = "<div class='listsTitle'>"+listsTitle+"</div><ul>"+htmlStructure+"</ul>";
                }
                else{
                    htmlStructure = "<ul>"+htmlStructure+"</ul>";
                }
            }

            return htmlStructure;
        },

        // display info related to the last word/symbol inserted from user
        showListInfo = function(){

            // get the structure to show as listInfo
            var htmlListsStructure = createHtmlListsStructure();

            // check if we have info to show
            if(htmlListsStructure === ""){
                // hide listInfo
                _this._itemListOptionsContainer.classList.remove("open");
                // wait to animation end
                setTimeout(function(){
                    // clean HTML inside listOptionsContainer
                    _this._itemListOptionsContainer.innerHTML = "";
                }, 300);
            }
            else{
                // clen html that we could have in our container
                _this._itemListOptionsContainer.innerHTML = "";
                // change to the new html structure
                _this._itemListOptionsContainer.innerHTML = htmlListsStructure;

                // apply click event to all listItems
                var allItems = _this._itemListOptionsContainer.querySelectorAll("ul li");
                for(var i=0; i<allItems.length; i++){
                    allItems[i].addEventListener("click", function(){
                        this.focus();
                        _this._itemSelectedListOptionIndex = this.getAttribute("tabindex");
                        _this._itemListOptionsContainer.addEventListener('keydown', scrollOnListWithKeys);
                        replaceTexOnSelectListOption(_this._dictionaryToWorkWith.infoCollection[this.getAttribute("dictionaryIndex")])
                    });
                }

                // show listInfo if we have lists to show
                if(_this._itemListOptionsContainer.querySelectorAll("ul li").length > 0){

                    // adapt listInfo to screen
                    var wrapper = window.getComputedStyle(_this._itemWrapper),
                        wrapperHeight = wrapper.getPropertyValue("height").replace("px", ""),
                        wrapperOffsetTop = _this._itemWrapper.offsetTop,
                        wrapperMiddlePointInScreen = Math.floor((wrapperHeight/2)+wrapperOffsetTop),
                        windowMiddleHeight = Math.floor(window.innerHeight/2);

                    if(wrapperMiddlePointInScreen > windowMiddleHeight){
                        _this._itemListOptionsContainer.setAttribute("showAtBottom", "false");
                    }
                    else{
                        _this._itemListOptionsContainer.setAttribute("showAtBottom", "true");
                    }

                    // open listInfo
                    _this._itemListOptionsContainer.classList.add("open");
                }
            }
        },

        // change text event
        onInputTextChange = function(evt){
            // check if user had pressed enter to select info
            if(_this._updatedText){
                _this._updatedText = false;
                return false;
            }

            // save the text status on caret context
            updatePhraseInCarretContext(_this._itemTextWrapper);

            // make nothing if we press some keys
            if(evt.keyCode === 37 || evt.keyCode === 39 || evt.keyCode === 16 || evt.keyCode === 91){
                return false;
            }

            // check if we have item on listinfo when we press up/down key
            if(evt.keyCode === 38 || evt.keyCode === 40){
                if(_this._itemListOptionsContainer.querySelectorAll("li").length > 0){
                    _this._itemSelectedListOptionIndex = 0;
                    _this._itemListOptionsContainer.querySelectorAll("li")[0].focus();
                    _this._itemListOptionsContainer.addEventListener('keydown', scrollOnListWithKeys); 
                }
                return false;
            }

            // reset values to work with when user insert an space in text
            if(_this._phraseOnCaretContextParts.leftTextLastWord === " " || 
                _this._phraseOnCaretContextParts.totalPhrase === ""){
                // remove listInfo
                _this._itemListOptionsContainer.classList.remove("open");
                // wait to animation end
                setTimeout(function(){
                    // clean HTML inside listOptionsContainer
                    _this._itemListOptionsContainer.innerHTML = "";
                }, 300);

                _this._dictionarySymbolToWorkWith = "";
                _this._dictionaryToWorkWith = [];
            }
            
            // check if the lastText inserted by user is a reserved word/symbol associated in our dictionary
            if(_this._defaultOptions.dictionary[_this._phraseOnCaretContextParts.leftTextLastWord]) {
                // save the reference about the word/symbol that we will work with
                _this._dictionarySymbolToWorkWith = _this._phraseOnCaretContextParts.leftTextLastWord;
                // update _dictionaryToWorkWith to macth with the reserved word/symbol that user inserted
                _this._dictionaryToWorkWith = _this._defaultOptions.dictionary[_this._phraseOnCaretContextParts.leftTextLastWord];
            }

            // check if the event fired and the last word/symbol is the same as before (eg. when we use @ we need to press two keys, the second if fix that!)
            if(_this._phraseOnCaretContextParts.leftTextLastWord !== _this._inputTextCaretLeftWord){
                // check if we have a symbol and a dictionary. if we don't have this two values we can't show the list of items
                if(_this._phraseOnCaretContextParts.leftTextLastWord.indexOf(_this._dictionarySymbolToWorkWith) === 0 && (_this._dictionarySymbolToWorkWith !== "" || _this._dictionaryToWorkWith.length > 0)){
                    showListInfo();
                }
                else{
                    if(_this._itemListOptionsContainer.querySelectorAll("li").length > 0){
                        // hide listInfo
                        _this._itemListOptionsContainer.classList.remove("open");
                        // wait to animation end
                        setTimeout(function(){
                            // clean HTML inside listOptionsContainer
                            _this._itemListOptionsContainer.innerHTML = "";
                        }, 300);
                    }
                }
            }
            _this._inputTextCaretLeftWord = _this._phraseOnCaretContextParts.leftTextLastWord;

            // update carret position
            _this._carretLastPosition = getCaretPosition(_this._itemTextWrapper);
            // update and reset info after change text
            _this._itemTextWrapper.innerHTML = _this._phraseOnCaretContextParts.totalPhrase;
            // _this._itemTextArea.value = _this._itemTextWrapper.innerHTML;
            triggerEvent(_this._itemTextArea, _this._itemTextWrapper.innerHTML);

            setCaretPos(_this._itemTextWrapper, _this._carretLastPosition);
        },

        // set behaviour on select/click a specific object, if we have more than one
        clickOnInputText = function(){
            // change z-index to put our selected itemWrapper on top
            var items = document.querySelectorAll(".os_texteditor_wrapper"),
                itemsNumber = 0;
            for(var i=0; i<items.length; i++){
                items[i].style="z-index: 0;";
                itemsNumber = i;
            }
            _this._itemWrapper.style = "z-index:"+itemsNumber;
        },

        // init function
        init = function(opts) {
            // update defaultOptions values
            for(var i=0; i<Object.keys(opts).length; i++){
                if(_this._defaultOptions[Object.keys(opts)[i]]){
                    _this._defaultOptions[Object.keys(opts)[i]] = opts[Object.keys(opts)[i]];
                }
            }

            // check if user had defined the dictionary to work with
            if(_this._defaultOptions.dictionary.length === 0){
                console.log("dictionary is missing!");
                return false;
            }
            else{
                // get the objects inside the array and save it as a new object with a custom strutcture
                var dictionary = {};
                for(var j=0; j<_this._defaultOptions.dictionary.length; j++){
                    dictionary[_this._defaultOptions.dictionary[j]["symbol"]] = {};
                    dictionary[_this._defaultOptions.dictionary[j]["symbol"]]["settings"] = _this._defaultOptions.dictionary[j]["configs"]["settings"];
                    dictionary[_this._defaultOptions.dictionary[j]["symbol"]]["infoCollection"] = [];
                    var infoCollection = _this._defaultOptions.dictionary[j]["configs"]["infoCollection"];
                    for(var k=0; k<infoCollection.length; k++){
                        if(infoCollection[k].json != ""){
                            dictionary[_this._defaultOptions.dictionary[j]["symbol"]]["infoCollection"].push(JSON.parse(infoCollection[k].json));
                        }
                    }
                }

                // update _this._defaultOptions.dictionary to new object structure
                _this._defaultOptions.dictionary = dictionary;
                _this._dictionarySymbols = Object.keys(_this._defaultOptions.dictionary);
            } 

            // fallback in case user doesn't pass the id for our element
            if(_this._defaultOptions.element[0] !== "."){
                // if we don't have a class in defaultOptions.element, convert the name into id monenculature
                _this._defaultOptions.element = "#"+_this._defaultOptions.element;
            }

            // save the reference of the block container
            _this._itemWrapper = document.querySelectorAll(_this._defaultOptions.element)[0];

            // check if we have the input textarea element
            if(_this._itemWrapper.querySelectorAll(".textPlaceholder textarea").length === 0){
                console.log("textarea element is missing! Assigned to element: " + _this._defaultOptions.element);
                return false;
            }
            
            // set info related items to work with
            _this._itemListOptionsContainer = _this._itemWrapper.querySelectorAll(".showOptions")[0];
            _this._itemTextWrapper = _this._itemWrapper.querySelectorAll(".textwrapper")[0];
            _this._itemTextWrapper.setAttribute("contenteditable", "true");
            _this._itemTextArea = _this._itemWrapper.querySelectorAll(".textPlaceholder textarea")[0];
            _this._itemTextArea.setAttribute("disabled", "");

            // save device type reference
            _this._deviceType = (document.querySelectorAll("body")[0].classList[0] ? document.querySelectorAll("body")[0].classList[0] : "desktop");

            // define the keyUp event to our text container
            _this._itemTextWrapper.addEventListener('keyup', onInputTextChange);
            
            // check if we have multiple items, change z-index on focus
            if(document.querySelectorAll(".os_texteditor_wrapper").length > 1){
                _this._itemTextWrapper.addEventListener('click', clickOnInputText);
            }
            
            // console.log(_this);
        };
    
    return {
        init: function(options) {
            init(options);
        },
        destroy: function(){
            destroy();
        }
    };
}