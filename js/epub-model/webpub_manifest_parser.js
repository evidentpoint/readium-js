/**
 * Created by michaels on 2017-04-28.
 */
//  Copyright (c) 2014 Readium Foundation and/or its licensees. All rights reserved.
//
//  Redistribution and use in source and binary forms, with or without modification,
//  are permitted provided that the following conditions are met:
//  1. Redistributions of source code must retain the above copyright notice, this
//  list of conditions and the following disclaimer.
//  2. Redistributions in binary form must reproduce the above copyright notice,
//  this list of conditions and the following disclaimer in the documentation and/or
//  other materials provided with the distribution.
//  3. Neither the name of the organization nor the names of its contributors may be
//  used to endorse or promote products derived from this software without specific
//  prior written permission.

define(['jquery', 'underscore', '../epub-fetch/markup_parser', 'URIjs', './package_document',
        './smil_document_parser', './metadata', './manifest'],
    function ($, _, MarkupParser, URI, PackageDocument, SmilDocumentParser, Metadata, Manifest) {

        // this will be set to href of book cover image
        var cover;
        
        // `WebpubManifestParser` builds PackageDocument based on Readium 2 Web Publication Manifest
        // its main goal is to build exactly the same PackageDocument that PackageDocumentParser does
        // the only parameter it takes is JSON representation of WebPub manifest
        var WebpubManifestParser = {};
        WebpubManifestParser.parse = function (webpubJson) {

            // form essential part of package document
            var metadata = getMetadata(webpubJson);
            var manifest = new Manifest(getJsonManifest(webpubJson));
            var spine = getJsonSpine(xmlDom, manifest, metadata);

            // after manifest is processed "cover" should be discovered 
            metadata.cover_href = cover;

            // create package document passing essential parts
            // R2: 
            // packageDocumentURL == undefined
            // resourceFetcher == undefined
            // there is an extra parameter webpubJson (as a fallback for non-anticipated functions)
            var packageDocument = new PackageDocument(undefined, undefined,
                metadata, spine, manifest, webpubJson);

            // R2: this is taken from webpubJson.metadata.direction
            // var page_prog_dir = getElemAttr(xmlDom, 'spine', "page-progression-direction");
            packageDocument.setPageProgressionDirection(webpubJson.metadata.direction);
            
            return new Promise.resolve(packageDocument);

            // R2: this is left out for now - we will figure out how to deal with MO later
            // this is the last that calls callback
            // fillSmilData(packageDocument, callback);

            
            // R2: this is how it was done for package doc parser
            // $.when(updateMetadataWithIBookProperties(metadata)).then(function () {
            //
            //     _packageFetcher.setPackageMetadata(metadata, function () {
            //         var packageDocument = new PackageDocument(publicationFetcher.getPackageUrl(),
            //             publicationFetcher, metadata, spine, manifest);
            //
            //         packageDocument.setPageProgressionDirection(page_prog_dir);
            //         fillSmilData(packageDocument, callback);
            //     });
            // });

        };

        // R2: this is left out for now - figure how R2 handles this
        function updateMetadataWithIBookProperties(metadata) {

            var dff = $.Deferred();

            //if layout not set
            if (!metadata.rendition_layout) {
                var pathToIBooksSpecificXml = "/META-INF/com.apple.ibooks.display-options.xml";

                publicationFetcher.relativeToPackageFetchFileContents(pathToIBooksSpecificXml, 'text', function (ibookPropText) {
                    if (ibookPropText) {
                        var parser = new MarkupParser();
                        var propModel = parser.parseXml(ibookPropText);
                        var fixLayoutProp = $("option[name=fixed-layout]", propModel)[0];
                        if (fixLayoutProp) {
                            var fixLayoutVal = $(fixLayoutProp).text();
                            if (fixLayoutVal === "true") {
                                metadata.rendition_layout = "pre-paginated";
                                console.log("using com.apple.ibooks.display-options.xml fixed-layout property");
                            }
                        }
                    }

                    dff.resolve();

                }, function (err) {

                    //console.log("com.apple.ibooks.display-options.xml not found");
                    dff.resolve();
                });
            }
            else {
                dff.resolve();
            }

            return dff.promise();
        }

        // R2: this is left out for now - we will figure out how to deal with MO later
        function fillSmilData(packageDocument, callback) {

            var smilParser = new SmilDocumentParser(packageDocument, publicationFetcher);

            smilParser.fillSmilData(function () {

                // return the parse result
                callback(packageDocument);
            });

        }


        function findXmlElemByLocalNameAnyNS(rootElement, localName, predicate) {
            var elements = rootElement.getElementsByTagNameNS("*", localName);
            if (predicate) {
                return _.find(elements, predicate);
            } else {
                return elements[0];
            }
        }

        function filterXmlElemsByLocalNameAnyNS(rootElement, localName, predicate) {
            var elements = rootElement.getElementsByTagNameNS("*", localName);
            return _.filter(elements, predicate);
        }

        function getElemText(rootElement, localName, predicate) {
            var foundElement = findXmlElemByLocalNameAnyNS(rootElement, localName, predicate);
            if (foundElement) {
                return foundElement.textContent;
            } else {
                return '';
            }
        }

        function getElemAttr(rootElement, localName, attrName, predicate) {
            var foundElement = findXmlElemByLocalNameAnyNS(rootElement, localName, predicate);
            if (foundElement) {
                return foundElement.getAttribute(attrName);
            } else {
                return '';
            }
        }

        function getMetaElemPropertyText(rootElement, attrPropertyValue) {

            var foundElement = findXmlElemByLocalNameAnyNS(rootElement, "meta", function (element) {
                return element.getAttribute("property") === attrPropertyValue;
            });

            if (foundElement) {
                return foundElement.textContent;
            } else {
                return '';
            }
        }

        // R2: fills in package doc metadata based on web pub manifest
        function getMetadata(webpubJson) {

            var metadata = new Metadata();
            
            // var metadataElem = findXmlElemByLocalNameAnyNS(webpubJson, "metadata");
            // var packageElem = findXmlElemByLocalNameAnyNS(webpubJson, "package");
            // var spineElem = findXmlElemByLocalNameAnyNS(webpubJson, "spine");


            // getElemText(metadataElem, "creator");
            metadata.author = webpubJson.metadata.author[0].name;
            
            // getElemText(metadataElem, "title");
            metadata.title = webpubJson.metadata.title;
                
            // getElemText(metadataElem, "description");
            metadata.description = webpubJson.metadata.description;

            // packageElem.getAttribute("version") ? packageElem.getAttribute("version") : "";
            metadata.epub_version = '';

            // getElemText(metadataElem, "identifier");
            metadata.id = webpubJson.metadata.identifier;
            
            // getElemText(metadataElem, "language");
            metadata.language = webpubJson.metadata.language;
            
            // getMetaElemPropertyText(metadataElem, "dcterms:modified");
            metadata.modified_date = webpubJson.metadata.modified;
            
            // R2: this is abstracted in R2, for now leave out
            // spineElem.getAttribute("toc") ? spineElem.getAttribute("toc") : "";
            metadata.ncx = '';
            
            // getElemText(metadataElem, "date");
            metadata.pubdate = webpubJson.metadata.date;
            
            // getElemText(metadataElem, "publisher");
            metadata.publisher = webpubJson.metadata.publisher[0].name;
                
            // getElemText(metadataElem, "rights");
            metadata.rights = webpubJson.metadata.rights;

            // R2: empty string for all of the following
            // getMetaElemPropertyText(metadataElem, "rendition:orientation");
            metadata.rendition_orientation = '';
            // getMetaElemPropertyText(metadataElem, "rendition:layout");
            metadata.rendition_layout = '';
            // getMetaElemPropertyText(metadataElem, "rendition:spread");
            metadata.rendition_spread = '';
            // getMetaElemPropertyText(metadataElem, "rendition:flow");
            metadata.rendition_flow = '';

            //http://www.idpf.org/epub/301/spec/epub-publications.html#fxl-property-viewport

            // R2: skipping for now setting of metadata.rendition_viewport and metadata.rendition_viewports
            metadata.rendition_viewport = '';
            metadata.rendition_viewports = [];

            // //metadata.rendition_viewport = getMetaElemPropertyText(metadataElem, "rendition:viewport");
            // metadata.rendition_viewport = getElemText(metadataElem, "meta", function (element) {
            //     return element.getAttribute("property") === "rendition:viewport" && !element.hasAttribute("refines")
            // });
            //
            // var viewports = [];
            // var viewportMetaElems = filterXmlElemsByLocalNameAnyNS(metadataElem, "meta", function (element) {
            //     return element.getAttribute("property") === "rendition:viewport" && element.hasAttribute("refines");
            // });
            // _.each(viewportMetaElems, function (currItem) {
            //     var id = currItem.getAttribute("refines");
            //     if (id) {
            //         var hash = id.indexOf('#');
            //         if (hash >= 0) {
            //             var start = hash + 1;
            //             var end = id.length - 1;
            //             id = id.substr(start, end);
            //         }
            //         id = id.trim();
            //     }
            //
            //     var vp = {
            //         refines: id,
            //         viewport: currItem.textContent
            //     };
            //     viewports.push(vp);
            // });
            //
            // metadata.rendition_viewports = viewports;


            // R2: skipping for now setting of metadata.mediaItems and metadata.media_overlay
            metadata.mediaItems = [];
            metadata.media_overlay = {};
            
            // // Media part
            // metadata.mediaItems = [];
            //
            // var overlayElems = filterXmlElemsByLocalNameAnyNS(metadataElem, "meta", function (element) {
            //     return element.getAttribute("property") === "media:duration" && element.hasAttribute("refines");
            // });
            //
            // _.each(overlayElems, function (currItem) {
            //     metadata.mediaItems.push({
            //         refines: currItem.getAttribute("refines"),
            //         duration: SmilDocumentParser.resolveClockValue(currItem.textContent)
            //     });
            // });
            //
            // metadata.media_overlay = {
            //     duration: SmilDocumentParser.resolveClockValue(
            //         getElemText(metadataElem, "meta", function (element) {
            //             return element.getAttribute("property") === "media:duration" && !element.hasAttribute("refines")
            //         })
            //     ),
            //     narrator: getMetaElemPropertyText(metadataElem, "media:narrator"),
            //     activeClass: getMetaElemPropertyText(metadataElem, "media:active-class"),
            //     playbackActiveClass: getMetaElemPropertyText(metadataElem, "media:playback-active-class"),
            //     smil_models: [],
            //     skippables: ["sidebar", "practice", "marginalia", "annotation", "help", "note", "footnote", "rearnote",
            //         "table", "table-row", "table-cell", "list", "list-item", "pagebreak"],
            //     escapables: ["sidebar", "bibliography", "toc", "loi", "appendix", "landmarks", "lot", "index",
            //         "colophon", "epigraph", "conclusion", "afterword", "warning", "epilogue", "foreword",
            //         "introduction", "prologue", "preface", "preamble", "notice", "errata", "copyright-page",
            //         "acknowledgments", "other-credits", "titlepage", "imprimatur", "contributors", "halftitlepage",
            //         "dedication", "help", "annotation", "marginalia", "practice", "note", "footnote", "rearnote",
            //         "footnotes", "rearnotes", "bridgehead", "page-list", "table", "table-row", "table-cell", "list",
            //         "list-item", "glossary"]
            // };

            return metadata;
        }

        // 
        function getJsonSpine(xmlDom, manifest, metadata) {

            var $spineElements;
            var jsonSpine = [];

            $spineElements = $(findXmlElemByLocalNameAnyNS(xmlDom, "spine")).children();
            $.each($spineElements, function (spineElementIndex, currSpineElement) {

                var $currSpineElement = $(currSpineElement);
                var idref = $currSpineElement.attr("idref") ? $currSpineElement.attr("idref") : "";
                var manifestItem = manifest.getManifestItemByIdref(idref);

                var id = $currSpineElement.attr("id");
                var viewport = undefined;
                _.each(metadata.rendition_viewports, function (vp) {
                    if (vp.refines == id) {
                        viewport = vp.viewport;
                        return true; // break
                    }
                });

                var spineItem = {
                    rendition_viewport: viewport,
                    idref: idref,
                    href: manifestItem.href,
                    manifest_id: manifestItem.id,
                    media_type: manifestItem.media_type,
                    media_overlay_id: manifestItem.media_overlay_id,
                    linear: $currSpineElement.attr("linear") ? $currSpineElement.attr("linear") : "",
                    properties: $currSpineElement.attr("properties") ? $currSpineElement.attr("properties") : ""
                };

                var parsedProperties = parsePropertiesString(spineItem.properties);
                $.extend(spineItem, parsedProperties);

                jsonSpine.push(spineItem);
            });

            return jsonSpine;
        }

        // convert web pub item into package doc manifest item
        // note that as a side effect we also finding "cover"
        // this is how webpubItem looks like
        // {
        //     "href": "cover.xhtml",
        //     "type": "application/xhtml+xml"
        // }
        function convertToPackageDocManifestItem(webpubItem) {

            var manifestItem = {
                href: webpubItem.href,
                media_type: webpubItem.type,
                // R2: these data is lost 
                id: '',
                media_overlay_id: '',
                properties: ''
            };
            
            // if webpubItem has "rel" property (relations array) that includes "cover"
            if (webpubItem.rel && webpubItem.rel.includes("cover")) {
                // set cover href
                cover = webpubItem.href;
            }
            
            return manifestItem;
        }

        // R2: when recreating PackageDocument manifest from WebPub manifest, we want to include items
        // in the spine and resources. Note, that "id" attribute of the manifest item is lost so will need to 
        // provide for its absense in dependent code
        // <item id="xchapter_004" href="chapter_004.xhtml" media-type="application/xhtml+xml"/>
        // todo: text - MO relation seems to be absent in WebPub 
        // <item id="xchapter_001" href="chapter_001.xhtml" media-type="application/xhtml+xml" media-overlay="chapter_001_overlay"/>
        function getJsonManifest(webpubJson) {
            // start with spine, continue with resources
            var spine = webpubJson.spine.map(convertToPackageDocManifestItem);
            var resources = webpubJson.resources.map(convertToPackageDocManifestItem);
            return spine.concat(resources);
            
            // $.each($manifestItems, function (manifestElementIndex, currManifestElement) {
            //
            //     var $currManifestElement = $(currManifestElement);
            //     var currManifestElementHref = $currManifestElement.attr("href") ? $currManifestElement.attr("href") :
            //         "";
            //     var manifestItem = {
            //
            //         href: currManifestElementHref,
            //         id: $currManifestElement.attr("id") ? $currManifestElement.attr("id") : "",
            //         media_overlay_id: $currManifestElement.attr("media-overlay") ?
            //             $currManifestElement.attr("media-overlay") : "",
            //         media_type: $currManifestElement.attr("media-type") ? $currManifestElement.attr("media-type") : "",
            //         properties: $currManifestElement.attr("properties") ? $currManifestElement.attr("properties") : ""
            //     };
            //     // console.log('pushing manifest item to JSON manifest. currManifestElementHref: [' + currManifestElementHref +
            //     //     '], manifestItem.href: [' + manifestItem.href +
            //     //     '], manifestItem:');
            //     // console.log(manifestItem);
            //     jsonManifest.push(manifestItem);
            // });
            //
            // return jsonManifest;
        }

        // function getCoverHref(xmlDom) {
        //
        //     var manifest;
        //     var $imageNode;
        //     manifest = findXmlElemByLocalNameAnyNS(xmlDom, "manifest");
        //
        //     // epub3 spec for a cover image is like this:
        //     /*<item properties="cover-image" id="ci" href="cover.svg" media-type="image/svg+xml" />*/
        //     $imageNode = $(findXmlElemByLocalNameAnyNS(manifest, "item", function (element) {
        //         var attr = element.getAttribute("properties");
        //         return attr && _.contains(attr.split(" "), "cover-image");
        //     }));
        //     if ($imageNode.length === 1 && $imageNode.attr("href")) {
        //         return $imageNode.attr("href");
        //     }
        //
        //     // some epub2's cover image is like this:
        //     /*<meta name="cover" content="cover-image-item-id" />*/
        //     var metaNode = $(findXmlElemByLocalNameAnyNS(xmlDom, "meta", function (element) {
        //         return element.getAttribute("name") === "cover";
        //     }));
        //     var contentAttr = metaNode.attr("content");
        //     if (metaNode.length === 1 && contentAttr) {
        //         $imageNode = $(findXmlElemByLocalNameAnyNS(manifest, "item", function (element) {
        //             return element.getAttribute("id") === contentAttr;
        //         }));
        //         if ($imageNode.length === 1 && $imageNode.attr("href")) {
        //             return $imageNode.attr("href");
        //         }
        //     }
        //
        //     // that didn't seem to work so, it think epub2 just uses item with id=cover
        //     $imageNode = $(findXmlElemByLocalNameAnyNS(manifest, "item", function (element) {
        //         return element.getAttribute("id") === "cover";
        //     }));
        //     if ($imageNode.length === 1 && $imageNode.attr("href")) {
        //         return $imageNode.attr("href");
        //     }
        //
        //     // seems like there isn't one, thats ok...
        //     return null;
        // }

        function parsePropertiesString(str) {
            var properties = {};
            var allPropStrs = str.split(" "); // split it on white space
            for (var i = 0; i < allPropStrs.length; i++) {

                //ReadiumSDK.Models.SpineItem.RENDITION_ORIENTATION_LANDSCAPE
                if (allPropStrs[i] === "rendition:orientation-landscape") properties.rendition_orientation = "landscape";

                //ReadiumSDK.Models.SpineItem.RENDITION_ORIENTATION_PORTRAIT
                if (allPropStrs[i] === "rendition:orientation-portrait") properties.rendition_orientation = "portrait";

                //ReadiumSDK.Models.SpineItem.RENDITION_ORIENTATION_AUTO
                if (allPropStrs[i] === "rendition:orientation-auto") properties.rendition_orientation = "auto";


                //ReadiumSDK.Models.SpineItem.RENDITION_SPREAD_NONE
                if (allPropStrs[i] === "rendition:spread-none") properties.rendition_spread = "none";

                //ReadiumSDK.Models.SpineItem.RENDITION_SPREAD_LANDSCAPE
                if (allPropStrs[i] === "rendition:spread-landscape") properties.rendition_spread = "landscape";

                //ReadiumSDK.Models.SpineItem.RENDITION_SPREAD_PORTRAIT
                if (allPropStrs[i] === "rendition:spread-portrait") properties.rendition_spread = "portrait";

                //ReadiumSDK.Models.SpineItem.RENDITION_SPREAD_BOTH
                if (allPropStrs[i] === "rendition:spread-both") properties.rendition_spread = "both";

                //ReadiumSDK.Models.SpineItem.RENDITION_SPREAD_AUTO
                if (allPropStrs[i] === "rendition:spread-auto") properties.rendition_spread = "auto";


                //ReadiumSDK.Models.SpineItem.RENDITION_FLOW_PAGINATED
                if (allPropStrs[i] === "rendition:flow-paginated") properties.rendition_flow = "paginated";

                //ReadiumSDK.Models.SpineItem.RENDITION_FLOW_SCROLLED_CONTINUOUS
                if (allPropStrs[i] === "rendition:flow-scrolled-continuous") properties.rendition_flow = "scrolled-continuous";

                //ReadiumSDK.Models.SpineItem.RENDITION_FLOW_SCROLLED_DOC
                if (allPropStrs[i] === "rendition:flow-scrolled-doc") properties.rendition_flow = "scrolled-doc";

                //ReadiumSDK.Models.SpineItem.RENDITION_FLOW_AUTO
                if (allPropStrs[i] === "rendition:flow-auto") properties.rendition_flow = "auto";


                //ReadiumSDK.Models.SpineItem.SPREAD_CENTER
                if (allPropStrs[i] === "rendition:page-spread-center") properties.page_spread = "page-spread-center";

                //ReadiumSDK.Models.SpineItem.SPREAD_LEFT
                if (allPropStrs[i] === "page-spread-left") properties.page_spread = "page-spread-left";

                //ReadiumSDK.Models.SpineItem.SPREAD_RIGHT
                if (allPropStrs[i] === "page-spread-right") properties.page_spread = "page-spread-right";

                //ReadiumSDK.Models.SpineItem.RENDITION_LAYOUT_REFLOWABLE
                if (allPropStrs[i] === "rendition:layout-reflowable") {
                    properties.fixed_flow = false; // TODO: only used in spec tests!
                    properties.rendition_layout = "reflowable";
                }

                //ReadiumSDK.Models.SpineItem.RENDITION_LAYOUT_PREPAGINATED
                if (allPropStrs[i] === "rendition:layout-pre-paginated") {
                    properties.fixed_flow = true; // TODO: only used in spec tests!
                    properties.rendition_layout = "pre-paginated";
                }
            }
            return properties;
        }


        return WebpubManifestParser;
    });
