package com.miaojiu.controller;


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

    @GetMapping("/hello")
    public String sayHello() {
        return "hello";
    }
}
