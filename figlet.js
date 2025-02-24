    /*
        FIGlet.js (a FIGDriver for FIGlet fonts)
        By Patrick Gillespie (patorjk@gmail.com)
        Originally Written For: http://patorjk.com/software/taag/
        License: MIT (with this header staying intact)
        
        This JavaScript code aims to fully implement the FIGlet spec.
        Full FIGlet spec: http://patorjk.com/software/taag/docs/figfont.txt
        
        If you use this for a public app, a link back to TAAG is appreciated  
        but not necessary.
    */

    "use strict";

    var Figlet = Figlet || (function() {

        // ---------------------------------------------------------------------
        // private static variables
        var FULL_WIDTH = 0,
            FITTING = 1,
            SMUSHING = 2,
            CONTROLLED_SMUSHING = 3;
        
        // ---------------------------------------------------------------------
        // private static methods

        /*
            This method takes in the oldLay and newLayout data from the FIGfont header file and returns
            the layout information.
        */
        function getSmushingRules(oldLayout, newLayout) {
            var rules = {};
            var val, index, len, code;
            var codes = [[16384,"vLayout",SMUSHING], [8192,"vLayout",FITTING], [4096, "vRule5", true], [2048, "vRule4", true],
                         [1024, "vRule3", true], [512, "vRule2", true], [256, "vRule1", true], [128, "hLayout", SMUSHING],
                         [64, "hLayout", FITTING], [32, "hRule6", true], [16, "hRule5", true], [8, "hRule4", true], [4, "hRule3", true],
                         [2, "hRule2", true], [1, "hRule1", true]]; 

            val = (newLayout !== null) ? newLayout : oldLayout;
            index = 0;
            len = codes.length;
            while ( index < len ) {
                code = codes[index];
                if (val >= code[0]) {
                    val = val - code[0];
                    rules[code[1]] = (typeof rules[code[1]] === "undefined") ? code[2] : rules[code[1]];
                } else if (code[1] !== "vLayout" && code[1] !== "hLayout") {
                    rules[code[1]] = false;
                }
                index++;
            }

            if (typeof rules["hLayout"] === "undefined") {
                if (oldLayout === 0) {
                    rules["hLayout"] = FITTING;
                } else if (oldLayout === -1) {
                    rules["hLayout"] = FULL_WIDTH;
                } else {
                    if (rules["hRule1"] || rules["hRule2"] || rules["hRule3"] || rules["hRule4"] ||rules["hRule5"] || rules["hRule6"] ) {
                        rules["hLayout"] = CONTROLLED_SMUSHING;
                    } else {
                        rules["hLayout"] = SMUSHING;
                    }
                }
            } else if (rules["hLayout"] === SMUSHING) {
                if (rules["hRule1"] || rules["hRule2"] || rules["hRule3"] || rules["hRule4"] ||rules["hRule5"] || rules["hRule6"] ) {
                    rules["hLayout"] = CONTROLLED_SMUSHING;
                }
            }
            
            if (typeof rules["vLayout"] === "undefined") {
                if (rules["vRule1"] || rules["vRule2"] || rules["vRule3"] || rules["vRule4"] ||rules["vRule5"]  ) {
                    rules["vLayout"] = CONTROLLED_SMUSHING;
                } else {
                    rules["vLayout"] = FULL_WIDTH;
                }
            } else if (rules["vLayout"] === SMUSHING) {
                if (rules["vRule1"] || rules["vRule2"] || rules["vRule3"] || rules["vRule4"] ||rules["vRule5"]  ) {
                    rules["vLayout"] = CONTROLLED_SMUSHING;
                }
            }
            
            return rules;   
        }

        /* The [vh]Rule[1-6]_Smush functions return the smushed character OR false if the two characters can't be smushed */

        /*
            Rule 1: EQUAL CHARACTER SMUSHING (code value 1)

                Two sub-characters are smushed into a single sub-character
                if they are the same.  This rule does not smush
                hardblanks.  (See rule 6 on hardblanks below)
        */
        function hRule1_Smush(ch1, ch2, hardBlank) {
            if (ch1 === ch2 && ch1 !== hardBlank) {return ch1;}
            return false;
        }

        /*
            Rule 2: UNDERSCORE SMUSHING (code value 2)

                An underscore ("_") will be replaced by any of: "|", "/",
                "\", "[", "]", "{", "}", "(", ")", "<" or ">".
        */
        function hRule2_Smush(ch1, ch2) {
            var rule2Str = "|/\\[]{}()<>";
            if (ch1 === "_") {
                if (rule2Str.indexOf(ch2) !== -1) {return ch2;}
            } else if (ch2 === "_") {
                if (rule2Str.indexOf(ch1) !== -1) {return ch1;}
            }
            return false;
        }
        
        /*
            Rule 3: HIERARCHY SMUSHING (code value 4)

                A hierarchy of six classes is used: "|", "/\", "[]", "{}",
                "()", and "<>".  When two smushing sub-characters are
                from different classes, the one from the latter class
                will be used.
        */
        function hRule3_Smush(ch1, ch2) {
            var rule3Classes = "| /\\ [] {} () <>";
            var r3_pos1 = rule3Classes.indexOf(ch1);
            var r3_pos2 = rule3Classes.indexOf(ch2);
            if (r3_pos1 !== -1 && r3_pos2 !== -1) {
                if (r3_pos1 !== r3_pos2 && Math.abs(r3_pos1-r3_pos2) !== 1) {
                    return rule3Classes.substr(Math.max(r3_pos1,r3_pos2), 1);
                }
            }
            return false;
        }

        /*
            Rule 4: OPPOSITE PAIR SMUSHING (code value 8)

                Smushes opposing brackets ("[]" or "]["), braces ("{}" or
                "}{") and parentheses ("()" or ")(") together, replacing
                any such pair with a vertical bar ("|").
        */
        function hRule4_Smush(ch1, ch2) {
            var rule4Str = "[] {} ()";
            var r4_pos1 = rule4Str.indexOf(ch1);
            var r4_pos2 = rule4Str.indexOf(ch2);
            if (r4_pos1 !== -1 && r4_pos2 !== -1) {
                if (Math.abs(r4_pos1-r4_pos2) <= 1) {
                    return "|";
                }
            }
            return false;
        }

        /*
            Rule 5: BIG X SMUSHING (code value 16)

                Smushes "/\" into "|", "\/" into "Y", and "><" into "X".
                Note that "<>" is not smushed in any way by this rule.
                The name "BIG X" is historical; originally all three pairs
                were smushed into "X".
        */
        function hRule5_Smush(ch1, ch2) {
            var rule5Str = "/\\ \\/ ><";
            var rule5Hash = {"0": "|", "3": "Y", "6": "X"};
            var r5_pos1 = rule5Str.indexOf(ch1);
            var r5_pos2 = rule5Str.indexOf(ch2);
            if (r5_pos1 !== -1 && r5_pos2 !== -1) {
                if ((r5_pos2-r5_pos1) === 1) {
                    return rule5Hash[r5_pos1];
                }
            }
            return false;
        }

        /*
            Rule 6: HARDBLANK SMUSHING (code value 32)

                Smushes two hardblanks together, replacing them with a
                single hardblank.  (See "Hardblanks" below.)
        */
        function hRule6_Smush(ch1, ch2, hardBlank) {
            if (ch1 === hardBlank && ch2 === hardBlank) {
                return hardBlank;
            }
            return false;
        }
        
        /*
            Rule 1: EQUAL CHARACTER SMUSHING (code value 256)

                Same as horizontal smushing rule 1.
        */
        function vRule1_Smush(ch1, ch2) {
            if (ch1 === ch2) {return ch1;}
            return false;
        }
        
        /*
            Rule 2: UNDERSCORE SMUSHING (code value 512)

                Same as horizontal smushing rule 2.
        */
        function vRule2_Smush(ch1, ch2) {
            var rule2Str = "|/\\[]{}()<>";
            if (ch1 === "_") {
                if (rule2Str.indexOf(ch2) !== -1) {return ch2;}
            } else if (ch2 === "_") {
                if (rule2Str.indexOf(ch1) !== -1) {return ch1;}
            }
            return false;
        }

        /*
            Rule 3: HIERARCHY SMUSHING (code value 1024)

                Same as horizontal smushing rule 3.
        */
        function vRule3_Smush(ch1, ch2) {
            var rule3Classes = "| /\\ [] {} () <>";
            var r3_pos1 = rule3Classes.indexOf(ch1);
            var r3_pos2 = rule3Classes.indexOf(ch2);
            if (r3_pos1 !== -1 && r3_pos2 !== -1) {
                if (r3_pos1 !== r3_pos2 && Math.abs(r3_pos1-r3_pos2) !== 1) {
                    return rule3Classes.substr(Math.max(r3_pos1,r3_pos2), 1);
                }
            }
            return false;
        }
        
        /*
            Rule 4: HORIZONTAL LINE SMUSHING (code value 2048)

                Smushes stacked pairs of "-" and "_", replacing them with
                a single "=" sub-character.  It does not matter which is
                found above the other.  Note that vertical smushing rule 1
                will smush IDENTICAL pairs of horizontal lines, while this
                rule smushes horizontal lines consisting of DIFFERENT
                sub-characters.
        */
        function vRule4_Smush(ch1, ch2) {
            if ( (ch1 === "-" && ch2 === "_") || (ch1 === "_" && ch2 === "-") ) {
                return "=";
            }
            return false;
        }
        
        /*
            Rule 5: VERTICAL LINE SUPERSMUSHING (code value 4096)

                This one rule is different from all others, in that it
                "supersmushes" vertical lines consisting of several
                vertical bars ("|").  This creates the illusion that
                FIGcharacters have slid vertically against each other.
                Supersmushing continues until any sub-characters other
                than "|" would have to be smushed.  Supersmushing can
                produce impressive results, but it is seldom possible,
                since other sub-characters would usually have to be
                considered for smushing as soon as any such stacked
                vertical lines are encountered.
        */
        function vRule5_Smush(ch1, ch2) {
            if ( ch1 === "|" && ch2 === "|" ) {
                return "|";
            }
            return false;
        }
        
        /*
            Universal smushing simply overrides the sub-character from the
            earlier FIGcharacter with the sub-character from the later
            FIGcharacter.  This produces an "overlapping" effect with some
            FIGfonts, wherein the latter FIGcharacter may appear to be "in
            front".
        */
        function uni_Smush(ch1, ch2, hardBlank) {
            if (ch2 === " " || ch2 === "") {
                return ch1;   
            } else if (ch2 === hardBlank && ch1 !== " ") {
                return ch1;
            } else {
                return ch2;
            }
        }

        // --------------------------------------------------------------------------
        // main vertical smush routines (excluding rules)

        /*
            txt1 - A line of text
            txt2 - A line of text
            opts - FIGlet options array
            
            About: Takes in two lines of text and returns one of the following:
            "valid" - These lines can be smushed together given the current smushing rules
            "end" - The lines can be smushed, but we're at a stopping point
            "invalid" - The two lines cannot be smushed together
        */
        function canVerticalSmush(txt1, txt2, opts) {
            if (opts.fittingRules.vLayout === FULL_WIDTH) {return "invalid";}
            var ii, len = Math.min(txt1.length, txt2.length);
            var ch1, ch2, endSmush = false, validSmush;
            if (len===0) {return "invalid";}
            
            for (ii = 0; ii < len; ii++) {
                ch1 = txt1.substr(ii,1);
                ch2 = txt2.substr(ii,1);
                if (ch1 !== " " && ch2 !== " ") {
                    if (opts.fittingRules.vLayout === FITTING) {
                        return "invalid";
                    } else if (opts.fittingRules.vLayout === SMUSHING) {
                        return "end";
                    } else {
                        if (vRule5_Smush(ch1,ch2)) {endSmush = endSmush || false; continue;} // rule 5 allow for "super" smushing, but only if we're not already ending this smush
                        validSmush = false;
                        validSmush = (opts.fittingRules.vRule1) ? vRule1_Smush(ch1,ch2) : validSmush;
                        validSmush = (!validSmush && opts.fittingRules.vRule2) ? vRule2_Smush(ch1,ch2) : validSmush;
                        validSmush = (!validSmush && opts.fittingRules.vRule3) ? vRule3_Smush(ch1,ch2) : validSmush;
                        validSmush = (!validSmush && opts.fittingRules.vRule4) ? vRule4_Smush(ch1,ch2) : validSmush;
                        endSmush = true;
                        if (!validSmush) {return "invalid";}
                    }
                }
            }
            if (endSmush) {
                return "end";   
            } else {
                return "valid";
            }
        }

        function getVerticalSmushDist(lines1, lines2, opts) {
            var maxDist = lines1.length;
            var len1 = lines1.length;
            var len2 = lines2.length;
            var subLines1, subLines2, slen;
            var curDist = 1;
            var ii, ret, result;
            while (curDist <= maxDist) {
                
                subLines1 = lines1.slice(Math.max(0,len1-curDist), len1);
                subLines2 = lines2.slice(0, Math.min(maxDist, curDist));
                
                slen = subLines2.length;
                result = "";
                for (ii = 0; ii < slen; ii++) {
                    ret = canVerticalSmush(subLines1[ii], subLines2[ii], opts);
                    if (ret === "end") {
                        result = ret;
                    } else if (ret === "invalid") {
                        result = ret;
                        break;
                    } else {
                        if (result === "") {
                            result = "valid";
                        }
                    }
                }
                
                if (result === "invalid") {curDist--;break;}
                if (result === "end") {break;}
                if (result === "valid") {curDist++;}
            }
            
            return Math.min(maxDist,curDist);
        }

        function verticallySmushLines(line1, line2, opts) {
            var ii, len = Math.min(line1.length, line2.length);
            var ch1, ch2, result = "", validSmush;
            
            for (ii = 0; ii < len; ii++) {
                ch1 = line1.substr(ii,1);
                ch2 = line2.substr(ii,1);
                if (ch1 !== " " && ch2 !== " ") {
                    if (opts.fittingRules.vLayout === FITTING) {
                        result += uni_Smush(ch1,ch2);
                    } else if (opts.fittingRules.vLayout === SMUSHING) {
                        result += uni_Smush(ch1,ch2);
                    } else {
                        validSmush = false;
                        validSmush = (opts.fittingRules.vRule5) ? vRule5_Smush(ch1,ch2) : validSmush;
                        validSmush = (!validSmush && opts.fittingRules.vRule1) ? vRule1_Smush(ch1,ch2) : validSmush;
                        validSmush = (!validSmush && opts.fittingRules.vRule2) ? vRule2_Smush(ch1,ch2) : validSmush;
                        validSmush = (!validSmush && opts.fittingRules.vRule3) ? vRule3_Smush(ch1,ch2) : validSmush;
                        validSmush = (!validSmush && opts.fittingRules.vRule4) ? vRule4_Smush(ch1,ch2) : validSmush;
                        result += validSmush;
                    }
                } else {
                    result += uni_Smush(ch1,ch2);
                }
            }
            return result;
        }

        function verticalSmush(lines1, lines2, overlap, opts) {
            var len1 = lines1.length;
            var len2 = lines2.length;
            var piece1 = lines1.slice(0, Math.max(0,len1-overlap));
            var piece2_1 = lines1.slice(Math.max(0,len1-overlap), len1);
            var piece2_2 = lines2.slice(0, Math.min(overlap, len2));
            var ii, len, line, piece2 = [], piece3, result = [];
            
            len = piece2_1.length;
            for (ii = 0; ii < len; ii++) {
                if (ii >= len2) {
                    line = piece2_1[ii];
                } else {
                    line = verticallySmushLines(piece2_1[ii], piece2_2[ii], opts);
                }
                piece2.push(line);
            }
            
            piece3 = lines2.slice(Math.min(overlap,len2), len2);
            
            return result.concat(piece1,piece2,piece3);
        }

        function padLines(lines, numSpaces) {
            var ii, len = lines.length, padding = "";
            for (ii = 0; ii < numSpaces; ii++) {
                padding += " ";   
            }
            for (ii = 0; ii < len; ii++) {
                lines[ii] += padding;   
            }
        }

        function smushVerticalFigLines(output, lines, opts) {
            var len1 = output[0].length;
            var len2 = lines[0].length;
            var overlap;
            if (len1 > len2) {
                padLines(lines, len1-len2);
            } else if (len2 > len1) {
                padLines(output, len2-len1);
            }
            overlap = getVerticalSmushDist(output, lines, opts);
            return verticalSmush(output, lines, overlap,opts);
        }

        // -------------------------------------------------------------------------
        // main horizontal smush routines (excluding rules)

        function getHorizontalSmushLength(txt1, txt2, opts) {
            if (opts.fittingRules.hLayout === FULL_WIDTH) {return 0;}
            var ii, len1 = txt1.length, len2 = txt2.length;
            var maxDist = len1;
            var curDist = 1;
            var breakAfter = false;
            var validSmush = false;
            var seg1, seg2, ch1, ch2;
            if (len1 === 0) {return 0;}
            
            distCal: while (curDist <= maxDist) {
                seg1 = txt1.substr(len1-curDist,curDist);
                seg2 = txt2.substr(0,Math.min(curDist,len2));
                for (ii = 0; ii < Math.min(curDist,len2); ii++) {
                    ch1 = seg1.substr(ii,1);
                    ch2 = seg2.substr(ii,1);
                    if (ch1 !== " " && ch2 !== " " ) {
                        if (opts.fittingRules.hLayout === FITTING) {
                            curDist = curDist - 1;
                            break distCal;
                        } else if (opts.fittingRules.hLayout === SMUSHING) {
                            if (ch1 === opts.hardBlank || ch2 === opts.hardBlank) {
                                curDist = curDist - 1;
                            }
                            break distCal;
                        } else {
                            breakAfter = true;
                            validSmush = false;
                            
                            validSmush = (opts.fittingRules.hRule1) ? hRule1_Smush(ch1,ch2,opts.hardBlank) : validSmush;
                            validSmush = (!validSmush && opts.fittingRules.hRule2) ? hRule2_Smush(ch1,ch2,opts.hardBlank) : validSmush;
                            validSmush = (!validSmush && opts.fittingRules.hRule3) ? hRule3_Smush(ch1,ch2,opts.hardBlank) : validSmush;
                            validSmush = (!validSmush && opts.fittingRules.hRule4) ? hRule4_Smush(ch1,ch2,opts.hardBlank) : validSmush;
                            validSmush = (!validSmush && opts.fittingRules.hRule5) ? hRule5_Smush(ch1,ch2,opts.hardBlank) : validSmush;
                            validSmush = (!validSmush && opts.fittingRules.hRule6) ? hRule6_Smush(ch1,ch2,opts.hardBlank) : validSmush;
                            
                            if (!validSmush) {
                                curDist = curDist - 1;
                                break distCal;
                            }
                        }
                    }
                }
                if (breakAfter) {break;}
                curDist++;
            }
            return Math.min(maxDist,curDist);
        }

        function horizontalSmush(textBlock1, textBlock2, overlap, opts) {
            var ii, jj, ch, outputFig = [],
                overlapStart,piece1,piece2,piece3,len1,len2,txt1,txt2;
                
            for (ii = 0; ii < opts.height; ii++) {
                outputFig[ii] = "";
            }
            for (ii = 0; ii < textBlock2.length; ii++) {
                if (ii < textBlock1.length) {
                    txt1 = textBlock1[ii];
                } else {
                    txt1 = "";
                }
                if (ii < textBlock2.length) {
                    txt2 = textBlock2[ii];
                } else {
                    txt2 = "";
                }
                len1 = txt1.length;
                len2 = txt2.length;
                overlapStart = len1-overlap;
                piece1 = txt1.substr(0,Math.max(0,overlapStart));
                piece2 = "";
                
                var seg1 = txt1.substr(Math.max(0,len1-overlap),overlap);
                var seg2 = txt2.substr(0,Math.min(overlap,len2));
                
                for (jj = 0; jj < overlap; jj++) {
                    var ch1 = (jj < len1) ? seg1.substr(jj,1) : " ";
                    var ch2 = (jj < len2) ? seg2.substr(jj,1) : " ";
                    
                    if (ch1 !== " " && ch2 !== " ") {
                        if (opts.fittingRules.hLayout === FITTING) {
                            piece2 += uni_Smush(ch1, ch2, opts.hardBlank);
                        } else if (opts.fittingRules.hLayout === SMUSHING) {
                            piece2 += uni_Smush(ch1, ch2, opts.hardBlank);
                        } else {
                            var nextCh = "";
                            nextCh = (!nextCh && opts.fittingRules.hRule1) ? hRule1_Smush(ch1,ch2,opts.hardBlank) : nextCh;
                            nextCh = (!nextCh && opts.fittingRules.hRule2) ? hRule2_Smush(ch1,ch2,opts.hardBlank) : nextCh;
                            nextCh = (!nextCh && opts.fittingRules.hRule3) ? hRule3_Smush(ch1,ch2,opts.hardBlank) : nextCh;
                            nextCh = (!nextCh && opts.fittingRules.hRule4) ? hRule4_Smush(ch1,ch2,opts.hardBlank) : nextCh;
                            nextCh = (!nextCh && opts.fittingRules.hRule5) ? hRule5_Smush(ch1,ch2,opts.hardBlank) : nextCh;
                            nextCh = (!nextCh && opts.fittingRules.hRule6) ? hRule6_Smush(ch1,ch2,opts.hardBlank) : nextCh;
                            nextCh = nextCh || uni_Smush(ch1, ch2, opts.hardBlank);
                            piece2 += nextCh;
                        }
                    } else {
                        piece2 += uni_Smush(ch1, ch2, opts.hardBlank);
                    }
                }

                if (overlap >= len2) {
                    piece3 = "";
                } else {
                    piece3 = txt2.substr(overlap,Math.max(0,len2-overlap));
                }
                outputFig[ii] = piece1 + piece2 + piece3;
            }
            return outputFig;
        }

        function generateFigTextLine(txt, figChars, opts) {
            var charIndex, figChar, overlap = 0, row, outputFigText = [], len=opts.height;
            for (row = 0; row < len; row++) {
                outputFigText[row] = "";
            }
            len = txt.length;
            for (charIndex = 0; charIndex < len; charIndex++) {
                figChar = figChars[txt.substr(charIndex,1).charCodeAt(0)];
                if (figChar) {
                    if (opts.fittingRules.hLayout !== FULL_WIDTH) {
                        overlap = 10000;
                        for (row = 0; row < opts.height; row++) {
                            overlap = Math.min(overlap, getHorizontalSmushLength(outputFigText[row], figChar[row], opts));
                        }
                        overlap = (overlap === 10000) ? 0 : overlap;
                    }
                    outputFigText = horizontalSmush(outputFigText, figChar, overlap, opts);
                }
            }
            for (row = 0; row < outputFigText.length; row++) {
                outputFigText[row] = outputFigText[row].replace(new RegExp("\\"+opts.hardBlank,"g")," ");
            }
            return outputFigText;
        }
        
        // -------------------------------------------------------------------------
        // object definition
        
        return function() {
            var me = this,
                opts = null,
                origOpts = null,
                comment = "",
                figChars = {},
                isFontLoaded = false;
        
            me.isReady = function() {
                return isFontLoaded;  
            };
        
            me.loadHorizontalOpts = function(layout) {
                var props = ["hLayout", "hRule1","hRule2","hRule3","hRule4","hRule5","hRule6"],
                    params = {}, prop, ii;
                if (layout === "default") {
                    for (ii = 0; ii < props.length; ii++) {
                        params[props[ii]] = origOpts.fittingRules[props[ii]];   
                    }
                } else if (layout === "full") {
                    params = {"hLayout": FULL_WIDTH,"hRule1":false,"hRule2":false,"hRule3":false,"hRule4":false,"hRule5":false,"hRule6":false};
                } else if (layout === "fitted") {
                    params = {"hLayout": FITTING,"hRule1":false,"hRule2":false,"hRule3":false,"hRule4":false,"hRule5":false,"hRule6":false};
                } else if (layout === "controlled smushing") {
                    params = {"hLayout": CONTROLLED_SMUSHING,"hRule1":true,"hRule2":true,"hRule3":true,"hRule4":true,"hRule5":true,"hRule6":true};
                } else if (layout === "universal smushing") {
                    params = {"hLayout": SMUSHING,"hRule1":false,"hRule2":false,"hRule3":false,"hRule4":false,"hRule5":false,"hRule6":false};
                } else {
                    return;   
                }
                for (prop in params) {
                    opts.fittingRules[prop] = params[prop];
                }
            };
        
            me.loadVerticalOpts = function(layout) {
                var props = ["vLayout", "vRule1","vRule2","vRule3","vRule4","vRule5"],
                    params = {}, prop, ii;
                if (layout === "default") {
                    for (ii = 0; ii < props.length; ii++) {
                        params[props[ii]] = origOpts.fittingRules[props[ii]];   
                    }
                } else if (layout === "full") {
                    params = {"vLayout": FULL_WIDTH,"vRule1":false,"vRule2":false,"vRule3":false,"vRule4":false,"vRule5":false};
                } else if (layout === "fitted") {
                    params = {"vLayout": FITTING,"vRule1":false,"vRule2":false,"vRule3":false,"vRule4":false,"vRule5":false};
                } else if (layout === "controlled smushing") {
                    params = {"vLayout": CONTROLLED_SMUSHING,"vRule1":true,"vRule2":true,"vRule3":true,"vRule4":true,"vRule5":true};
                } else if (layout === "universal smushing") {
                    params = {"vLayout": SMUSHING,"vRule1":false,"vRule2":false,"vRule3":false,"vRule4":false,"vRule5":false};
                } else {
                    return;   
                }
                for (prop in params) {
                    opts.fittingRules[prop] = params[prop];
                }
            };
        
            me.getFontType = function() {
                return "fig";
            };
        
            me.load = function(data) {
                data = data.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
                var lines = data.split("\n");
                var headerData = lines.splice(0,1)[0].split(" ");
                opts = {};
                opts.hardBlank = headerData[0].substr(5,1);
                opts.height = parseInt(headerData[1], 10);
                opts.baseline = parseInt(headerData[2], 10);
                opts.maxLength = parseInt(headerData[3], 10);
                opts.oldLayout = parseInt(headerData[4], 10);
                opts.numCommentLines = parseInt(headerData[5], 10);
                opts.printDirection = (headerData.length >= 6) ? parseInt(headerData[6], 10) : 0;
                opts.fullLayout = (headerData.length >= 7) ? parseInt(headerData[7], 10) : null;
                opts.codeTagCount = (headerData.length >= 8) ? parseInt(headerData[8], 10) : null;            
                opts.fittingRules = getSmushingRules(opts.oldLayout, opts.fullLayout);
                origOpts = opts;
                comment = lines.splice(0,opts.numCommentLines).join("\n");
                figChars = {};
                
                var charNums = [], cNum, ii;
                for (ii = 32; ii <= 126; ii++) {
                    charNums.push(ii);   
                }
                charNums = charNums.concat(196, 214, 220, 228, 246, 252, 223);
                figChars.numChars = 0;
                
                var endCharRegEx;
                
                while (lines.length > 0 && figChars.numChars < charNums.length) {
                    cNum = charNums[figChars.numChars];
                    figChars[cNum] = lines.splice(0,opts.height);
                    for (ii = 0; ii < opts.height; ii++) {
                        if (typeof figChars[cNum][ii] === "undefined") {
                            figChars[cNum][ii] = "";
                        } else {
                            endCharRegEx = new RegExp("\\"+figChars[cNum][ii].substr(figChars[cNum][ii].length-1,1)+"+$");
                            figChars[cNum][ii] = figChars[cNum][ii].replace(endCharRegEx,"");
                        }
                    }
                    figChars.numChars++;
                }
                
                while (lines.length > 0) {
                    cNum = lines.splice(0,1)[0].split(" ")[0];
                    if ( /^0[xX][0-9a-fA-F]+$/.test(cNum) ) {
                        cNum = parseInt(cNum, 16);
                    } else if ( /^0[0-7]+$/.test(cNum) ) {
                        cNum = parseInt(cNum, 8);
                    } else if ( /^[0-9]+$/.test(cNum) ) {
                        cNum = parseInt(cNum, 10);
                    } else {
                        if (cNum === "") {break;}
                        break;
                    }
                    
                    figChars[cNum] = lines.splice(0,opts.height);
                    for (ii = 0; ii < opts.height; ii++) {
                        if (typeof figChars[cNum][ii] === "undefined") {
                            figChars[cNum][ii] = "";
                        } else {
                            endCharRegEx = new RegExp("\\"+figChars[cNum][ii].substr(figChars[cNum][ii].length-1,1)+"+$");
                            figChars[cNum][ii] = figChars[cNum][ii].replace(endCharRegEx,"");
                        }
                    }
                    figChars.numChars++;
                }
                
                isFontLoaded = true;
            };
            
            me.getComment = function() {
                return comment;   
            };
            
            me.getText = function(txt) {
                txt = txt.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
                var lines = txt.split("\n");
                var figLines = [];
                var ii, len, output;
                len = lines.length;
                for (ii = 0; ii < len; ii++) {
                    figLines.push( generateFigTextLine(lines[ii], figChars, opts) );
                }
                len = figLines.length;
                output = figLines[0];
                for (ii = 1; ii < len; ii++) {
                    output = smushVerticalFigLines(output, figLines[ii], opts);
                }
                
                return output.join("\n");
            };
        };
    })();