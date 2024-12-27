package com.miaojiu.controller;


import com.miaojiu.comment.vo.Result;
import com.miaojiu.service.JsonToolsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/miaojiu/tools/json")
@RequiredArgsConstructor
public class JsonToolsController {

    private final JsonToolsService jsonToolsService;

    @GetMapping("/hello")
    public Result<String> sayHello() {
        return Result.success(jsonToolsService.swyHello());
    }
}
