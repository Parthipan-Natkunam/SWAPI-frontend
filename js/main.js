"use strict";
var responseData = []; //variable to cache response data inprder to save repeated network calls.
var filmData = {};
var fullResultsArr = [];
var isloading = false;

$(function(){
	handleScrollEvents();
	loadAppData();
});

function loadAppData(isPagination){
	var urlToFetch = !!isPagination ? responseData[responseData.length-1].next : void 0;
	if(isPagination && !urlToFetch) return;
	blockUI();
	buildCacheData(urlToFetch).then(function(){
		populateFilmTitlesInCachedData();
		var resultData = responseData[responseData.length-1].results;
		var tplStr = preparePeopleTemplate(resultData);
		appendTemplateToDOM(tplStr,isPagination);
		concatAllPageDataForSearch();
		attachEventCallBacks();
		isloading = false;
		unblockUI();
	}).catch(function(){

	});		
}

function getPeopleDetailsFromServer(endPoint){
	endPoint = endPoint || 'https://swapi.co/api/people/';
	var peoplePromise = $.Deferred();
	$.ajax({
		url: endPoint,
		method:'GET',
		error:function(){
			peoplePromise.reject({isError: true,msg:'Failed to fetch people data'});
		},
		success:function(response){
			peoplePromise.resolve(response);
		}
	});
	return peoplePromise.promise();
}

function getFilmTitleFromServer(filmUrl){
	var filmPromise = $.Deferred();
	$.ajax({
		url: filmUrl,
		method:'GET',
		error:function(){
			filmPromise.reject({isError:true,msg:'Failed to fetch film data'});
		},
		success:function(response){
			filmPromise.resolve(response.title);
		}
	});
	return filmPromise.promise();
}

function buildCacheData(peopleUrl){
	var iterationPromise = $.Deferred();
	var filmUrlArr = [];
	var fetchedFilmCounter =0;
	getPeopleDetailsFromServer(peopleUrl).then(function(response){
		if(!_.isEmpty(response)){
				response.page = responseData.length + 1;
				responseData.push(response);
				var lastItemIndex = responseData.length-1;
				_.each(responseData[lastItemIndex].results,function(result,index){
						var currentPersonObj = responseData[lastItemIndex].results[index];
						currentPersonObj.filmTitles=[];
						var filmEndPointsArr = currentPersonObj.films;
						_.each(filmEndPointsArr,function(filmUrl){
							filmUrlArr.push(filmUrl);
						});

				});
				var filmUrls = _.uniq(filmUrlArr)
				_.each(filmUrls,function(url){
					if(_.isEmpty(filmData[url])){
						getFilmTitleFromServer(url).then(function(title){
							filmData[url] = title;
							fetchedFilmCounter+=1;
							if(fetchedFilmCounter === filmUrls.length){
								iterationPromise.resolve();
							}
						}).catch(function(){
							iterationPromise.reject({isError:true,msg:'FILM_FETCH_FAILURE'});
						});
					}else{
						fetchedFilmCounter+=1;
						if(fetchedFilmCounter === filmUrls.length){
							iterationPromise.resolve();
						}
					}	
				});
		}else{
			iterationPromise.reject({isError:true,msg:'NO_DATA'});
		}
		
	}).catch(function(){
		iterationPromise.reject({isError:true,msg:'PEOPLE_FETCH_FAILURE'});
	});
	return iterationPromise.promise();
}

function preparePeopleTemplate(data){
	var templateString = '';
	if(!_.isEmpty(data)){
		_.each(data,function(datum,index){
			templateString += `<div class="card">
				<p><span class="f-bold">Name: </span> ${datum.name}</p>
				<p><span class="f-bold">Gender: </span> ${datum.gender}</p>
			    <p><span class="f-bold">Birth Year: </span> ${datum['birth_year']}</p>
			    <p><span class="f-bold">Film Titles: </span></p>
				<ul class="film-titles">
					${datum.filmTitles.map(title=>  `<li>${title}</li>`)}
				</ul>
			</div>`;
		});
	}
	return templateString;
}

function populateFilmTitlesInCachedData(){
	var filmUrlRefArr = Object.keys(filmData);
	_.each(responseData[responseData.length-1].results,function(resultData){
		var filmTitlesStr = '';
		_.each(resultData.films,function(filmUrl){
			resultData.filmTitles.push(filmData[filmUrl]);
			filmTitlesStr += filmData[filmUrl] ;
		});
		resultData.filmTitlesStr=filmTitlesStr.replace(/\s/g,'');
	});
}

function appendTemplateToDOM(tplStr,isPagination){
	if(!isPagination) $('#results-container').empty();
	$('#results-container').append(tplStr);
}

function attachEventCallBacks(){
	$('#name-srch,#byr-srch,#gndr-srch,#title-srch').keyup(searchByUserInput);
	$('#scroll-top').click(scrollToTop);
	$('#clear-filters').click(resetFilters);
}

function searchByUserInput(e){
	var searchTerm =$(e.currentTarget).val();
	var filterKeyMap = {
		'name-srch' : 'name',
		'byr-srch': 'birth_year',
		'gndr-srch'	: 'gender',
		'title-srch' : 'filmTitlesStr'	
	}
	$('#clear-filters').fadeIn();
	if(_.isEmpty($.trim(searchTerm))) return;
	var searchKey = filterKeyMap[$(e.currentTarget).attr('id')];
	if(searchKey === 'filmTitlesStr') searchTerm = searchTerm.replace(/\s/g,'');
	var filteredData = [];
	filteredData = _.filter(fullResultsArr,function(res){
		return res[searchKey].toLowerCase().indexOf(searchTerm.toLowerCase()) > -1;
	});
	var remainingFilters = _.without(Object.keys(filterKeyMap),$(e.currentTarget).attr('id'));
	var tempDataArr =[]
	_.each(remainingFilters,function(filter){
		if($('#'+filter).val() !== ""){
			searchKey = filterKeyMap[filter];
			tempDataArr = _.filter(filteredData,function(data){
				return data[searchKey].toLowerCase().indexOf($('#'+filter).val().toLowerCase()) > -1;
			});
		}
		if(!_.isEmpty(tempDataArr)) filteredData = _.intersection(filteredData,tempDataArr);
	});
	appendTemplateToDOM(preparePeopleTemplate(filteredData));
}

function resetFilters(e){
	$(e.currentTarget).fadeOut();
	$('#name-srch,#byr-srch,#gndr-srch,#title-srch').val('');
    if(fullResultsArr.length > 0){
		appendTemplateToDOM(preparePeopleTemplate(fullResultsArr));
    }else{
    	loadAppData();
    }
}

function concatAllPageDataForSearch(){
	_.each(responseData,function(response){
		fullResultsArr = fullResultsArr.concat(response.results);
	});
	fullResultsArr = _.uniq(fullResultsArr);
}

function handleScrollEvents(){
	$(window).scroll(function() {
	    var docHeight = $(document).height();
	    var scrollPosition = $(window).height() + $(window).scrollTop();
	    if ($(this).scrollTop() > 100) {
	        $('#scroll-top').fadeIn();
	    } else {
	        $('#scroll-top').fadeOut();
	    }
	    if ((docHeight - scrollPosition) / docHeight === 0) {
	    	if(!isloading && $('#clear-filters').is(':hidden')){ //disable fetching paginated data if search result is rendered 
	    		isloading = true;
	    		loadAppData(true);
	    	}
	    }
	});
}

function scrollToTop(){
	$('html, body').animate({ scrollTop: 0 }, "slow");
}

function blockUI(){
	$('#loader').fadeIn();
}

function unblockUI(){
	$('#loader').fadeOut();
}

